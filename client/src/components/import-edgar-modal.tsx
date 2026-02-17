import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Globe, Loader2, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ImportEdgarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statementType: "income-statement" | "balance-sheet" | "cash-flow";
  fieldDefs: Array<{ key: string; label: string }>;
  years: number[];
  onImport: (data: Record<number, Record<string, number>>) => void;
}

interface EdgarParsedData {
  years: number[];
  statementType: string;
  data: Record<number, Record<string, number>>;
  companyName: string;
  filingDate: string;
  matchedFields: string[];
  unmatchedGaap: string[];
}

const STATEMENT_LABELS: Record<string, string> = {
  "income-statement": "Income Statement",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow Statement",
};

export function ImportEdgarModal({ open, onOpenChange, statementType, fieldDefs, years, onImport }: ImportEdgarModalProps) {
  const [url, setUrl] = useState("");
  const [overrideType, setOverrideType] = useState<string>(statementType);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<EdgarParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setParsed(null);

    try {
      const result = await apiRequest("POST", "/api/parse-edgar", {
        url: url.trim(),
        statementType: overrideType,
      });
      const data: EdgarParsedData = await result.json();

      if (!data.years || data.years.length === 0) {
        setError("No annual financial data found in this filing. Make sure the URL points to a 10-K or 10-Q filing document.");
        return;
      }

      setParsed(data);
    } catch (err: any) {
      const msg = err?.message || "Failed to parse filing";
      setError(msg.includes("sec.gov") ? msg : `Error: ${msg}. Make sure you're using a direct SEC EDGAR filing URL.`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!parsed) return;

    const filtered: Record<number, Record<string, number>> = {};
    const validKeys = new Set(fieldDefs.map(f => f.key));

    for (const [yearStr, fields] of Object.entries(parsed.data)) {
      const year = parseInt(yearStr);
      if (!years.includes(year)) continue;

      const yearData: Record<string, number> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (validKeys.has(key)) {
          yearData[key] = value;
        }
      }
      if (Object.keys(yearData).length > 0) {
        filtered[year] = yearData;
      }
    }

    if (Object.keys(filtered).length === 0) {
      setError(`No matching years found. The filing contains years ${parsed.years.join(", ")} but your model covers ${years.join("-")}.`);
      return;
    }

    onImport(filtered);
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setUrl("");
    setParsed(null);
    setError(null);
    setLoading(false);
  };

  const matchingYears = parsed ? parsed.years.filter(y => years.includes(y)) : [];
  const nonMatchingYears = parsed ? parsed.years.filter(y => !years.includes(y)) : [];
  const validKeys = new Set(fieldDefs.map(f => f.key));
  const displayFields = parsed ? parsed.matchedFields.filter(f => validKeys.has(f)) : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Import from SEC EDGAR
          </DialogTitle>
          <DialogDescription>
            Paste a direct link to an SEC EDGAR filing (10-K or 10-Q) to automatically extract {STATEMENT_LABELS[statementType] || "financial"} data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>SEC EDGAR Filing URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.sec.gov/Archives/edgar/data/..."
              className="font-mono text-sm"
              data-testid="input-edgar-url"
            />
            <p className="text-xs text-muted-foreground">
              Find filings at <span className="font-medium">sec.gov/cgi-bin/browse-edgar</span> — look for the HTML document link in 10-K or 10-Q filings.
            </p>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-2">
              <Label>Statement Type</Label>
              <Select value={overrideType} onValueChange={setOverrideType}>
                <SelectTrigger className="w-[200px]" data-testid="select-statement-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income-statement">Income Statement</SelectItem>
                  <SelectItem value="balance-sheet">Balance Sheet</SelectItem>
                  <SelectItem value="cash-flow">Cash Flow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleFetch}
              disabled={!url.trim() || loading}
              data-testid="button-fetch-edgar"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Parsing Filing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-1" />
                  Fetch & Parse
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsed && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  {parsed.companyName || "Filing"} — {STATEMENT_LABELS[parsed.statementType] || parsed.statementType}
                </span>
                <Badge variant="outline">{parsed.matchedFields.length} fields found</Badge>
                <Badge variant="outline">{parsed.years.length} years</Badge>
                {displayFields.length > 0 && (
                  <Badge variant="secondary">{displayFields.length} importable</Badge>
                )}
              </div>

              {matchingYears.length > 0 && (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-muted-foreground">Matching your model:</span>
                  {matchingYears.map(y => (
                    <Badge key={y} variant="default">{y}</Badge>
                  ))}
                  {nonMatchingYears.length > 0 && (
                    <>
                      <span className="text-muted-foreground ml-2">Not in model:</span>
                      {nonMatchingYears.map(y => (
                        <Badge key={y} variant="outline" className="text-muted-foreground">{y}</Badge>
                      ))}
                    </>
                  )}
                </div>
              )}

              {matchingYears.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    No year overlap. Filing has {parsed.years.join(", ")} but your model covers {years[0]}-{years[years.length - 1]}.
                    You may need to adjust your company's year range.
                  </span>
                </div>
              )}

              {displayFields.length > 0 && matchingYears.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10">Line Item</TableHead>
                        {matchingYears.map(yr => (
                          <TableHead key={yr} className="text-right">{yr}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayFields.map(key => {
                        const fieldDef = fieldDefs.find(f => f.key === key);
                        return (
                          <TableRow key={key}>
                            <TableCell className="text-sm sticky left-0 bg-background z-10">{fieldDef?.label || key}</TableCell>
                            {matchingYears.map(yr => {
                              const val = parsed.data[yr]?.[key];
                              return (
                                <TableCell key={yr} className="text-right text-sm font-mono">
                                  {val !== undefined
                                    ? val.toLocaleString("en-US", { maximumFractionDigits: 0 })
                                    : <span className="text-muted-foreground">--</span>}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-edgar">Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || displayFields.length === 0 || matchingYears.length === 0}
            data-testid="button-import-edgar"
          >
            Import {displayFields.length} Fields ({matchingYears.length} yrs)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
