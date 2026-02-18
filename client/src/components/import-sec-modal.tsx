import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, AlertCircle, FileText, CheckCircle2, Download, Building2, Calendar, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImportSecModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  modelTicker?: string | null;
  modelName: string;
}

interface CompanyResult {
  cik: string;
  companyName: string;
  ticker: string;
}

interface Filing {
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
  form: string;
  reportDate: string;
  filingUrl: string;
}

interface ParsedStatements {
  incomeStatement: { years: number[]; matchedFields: string[]; data: Record<number, Record<string, number>> };
  balanceSheet: { years: number[]; matchedFields: string[]; data: Record<number, Record<string, number>> };
  cashFlow: { years: number[]; matchedFields: string[]; data: Record<number, Record<string, number>> };
}

type Step = "search" | "filings" | "preview" | "importing" | "done";

const formatCurrency = (val: number): string => {
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
};

export function ImportSecModal({ open, onOpenChange, modelId, modelTicker, modelName }: ImportSecModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("search");
  const [ticker, setTicker] = useState(modelTicker || "");
  const [searching, setSearching] = useState(false);
  const [company, setCompany] = useState<CompanyResult | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [selectedFiling, setSelectedFiling] = useState<Filing | null>(null);
  const [loadingFilings, setLoadingFilings] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStatements | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    setSearching(true);
    setError(null);
    setCompany(null);
    setFilings([]);

    try {
      const res = await apiRequest("GET", `/api/sec/search/${encodeURIComponent(ticker.trim().toUpperCase())}`);
      const data: CompanyResult = await res.json();
      setCompany(data);

      const filingsRes = await apiRequest("GET", `/api/sec/filings/${data.cik}`);
      const filingsData: Filing[] = await filingsRes.json();
      setFilings(filingsData);
      setStep("filings");
    } catch (err: any) {
      setError(err?.message || `Could not find "${ticker}" on SEC EDGAR. Make sure it's a valid US-listed ticker.`);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFiling = async (filing: Filing) => {
    setSelectedFiling(filing);
    setParsing(true);
    setError(null);
    setParsedData(null);

    try {
      const res = await apiRequest("POST", "/api/sec/parse-all-statements", {
        filingUrl: filing.filingUrl,
      });
      const data: ParsedStatements = await res.json();
      setParsedData(data);
      setStep("preview");
    } catch (err: any) {
      setError(err?.message || "Failed to parse the filing. Try a different filing.");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFiling || !parsedData) return;
    setImporting(true);
    setStep("importing");
    setError(null);

    try {
      const res = await apiRequest("POST", `/api/models/${modelId}/import-sec`, {
        filingUrl: selectedFiling.filingUrl,
      });
      const result = await res.json();
      setImportResult(result);
      setStep("done");

      queryClient.invalidateQueries({ queryKey: ["/api/models"], exact: true });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "revenue-line-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "revenue-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "valuation-comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", modelId, "assumptions"] });

      toast({
        title: "SEC Data Imported",
        description: `Imported ${result.importedYears?.length || 0} years of financial data. All statements updated.`,
      });
    } catch (err: any) {
      setError(err?.message || "Import failed");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("search");
    setTicker(modelTicker || "");
    setCompany(null);
    setFilings([]);
    setSelectedFiling(null);
    setParsedData(null);
    setImportResult(null);
    setError(null);
    onOpenChange(false);
  };

  const allYears = parsedData
    ? Array.from(new Set([
        ...parsedData.incomeStatement.years,
        ...parsedData.balanceSheet.years,
        ...parsedData.cashFlow.years,
      ])).sort()
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-sec-modal-title">
            <FileText className="h-5 w-5" />
            Import SEC Filing Data
          </DialogTitle>
          <DialogDescription>
            Search by ticker to find 10-K filings and import financial data into {modelName}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-sec-error">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "search" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter ticker (e.g., AAPL, MSFT, MRK)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
                data-testid="input-sec-ticker"
              />
              <Button
                onClick={handleSearch}
                disabled={searching || !ticker.trim()}
                data-testid="button-sec-search"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Search className="h-4 w-4 mr-1" /> Search</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Searches SEC EDGAR for US-listed company filings. Enter the stock ticker symbol.
            </p>
          </div>
        )}

        {step === "filings" && company && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium" data-testid="text-sec-company">{company.companyName}</div>
                    <div className="text-sm text-muted-foreground">
                      {company.ticker} &middot; CIK: {company.cik}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setStep("search"); setCompany(null); setFilings([]); }} className="ml-auto" data-testid="button-sec-change-ticker">
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>

            {filings.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                No 10-K filings found for {company.ticker}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Select a 10-K filing to import:</p>
                {filings.map((f) => (
                  <Card
                    key={f.accessionNumber}
                    className="hover-elevate cursor-pointer"
                    onClick={() => handleSelectFiling(f)}
                    data-testid={`card-filing-${f.accessionNumber}`}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <div className="font-medium text-sm">{f.form}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Filed: {f.filingDate}
                              {f.reportDate && <> &middot; Period: {f.reportDate}</>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {parsing && selectedFiling?.accessionNumber === f.accessionNumber ? (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Parsing...
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <ArrowRight className="h-3 w-3 mr-1" /> Select
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "preview" && parsedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-medium text-sm">
                  {company?.companyName} &middot; {selectedFiling?.form} ({selectedFiling?.filingDate})
                </div>
                <div className="text-xs text-muted-foreground">
                  Years found: {allYears.join(", ")} &middot; All three financial statements will be imported
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep("filings"); setParsedData(null); }} data-testid="button-sec-back-filings">
                Back
              </Button>
            </div>

            <Tabs defaultValue="income-statement">
              <TabsList>
                <TabsTrigger value="income-statement" data-testid="tab-preview-is">
                  Income Statement ({parsedData.incomeStatement.matchedFields.length})
                </TabsTrigger>
                <TabsTrigger value="balance-sheet" data-testid="tab-preview-bs">
                  Balance Sheet ({parsedData.balanceSheet.matchedFields.length})
                </TabsTrigger>
                <TabsTrigger value="cash-flow" data-testid="tab-preview-cf">
                  Cash Flow ({parsedData.cashFlow.matchedFields.length})
                </TabsTrigger>
              </TabsList>

              {(["income-statement", "balance-sheet", "cash-flow"] as const).map((stType) => {
                const stData = stType === "income-statement" ? parsedData.incomeStatement
                  : stType === "balance-sheet" ? parsedData.balanceSheet
                  : parsedData.cashFlow;
                const stYears = stData.years;
                return (
                  <TabsContent key={stType} value={stType}>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <Table data-testid={`table-preview-${stType}`}>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[180px] sticky left-0 bg-card z-10">Field</TableHead>
                            {stYears.map(y => (
                              <TableHead key={y} className="text-right min-w-[100px]">{y}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stData.matchedFields.map(field => (
                            <TableRow key={field}>
                              <TableCell className="font-medium text-sm sticky left-0 bg-card z-10">{field}</TableCell>
                              {stYears.map(y => {
                                const val = stData.data[y]?.[field];
                                return (
                                  <TableCell key={y} className="text-right text-sm">
                                    {val !== undefined ? formatCurrency(val) : <span className="text-muted-foreground">--</span>}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">
              Importing financial data and recalculating model...
            </div>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div className="text-center">
                <div className="font-medium text-lg">Import Complete</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Imported {importResult.importedYears?.length || 0} years ({importResult.importedYears?.join(", ")})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold" data-testid="text-is-fields">{importResult.statements?.incomeStatement || 0}</div>
                  <div className="text-xs text-muted-foreground">IS Fields</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold" data-testid="text-bs-fields">{importResult.statements?.balanceSheet || 0}</div>
                  <div className="text-xs text-muted-foreground">BS Fields</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold" data-testid="text-cf-fields">{importResult.statements?.cashFlow || 0}</div>
                  <div className="text-xs text-muted-foreground">CF Fields</div>
                </CardContent>
              </Card>
            </div>

            {importResult.yearRangeExpanded && (
              <div className="text-xs text-muted-foreground text-center">
                Model year range expanded to {importResult.newStartYear}&ndash;{importResult.newEndYear}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button onClick={handleImport} disabled={importing} data-testid="button-sec-import">
              <Download className="h-4 w-4 mr-1" />
              Import All Statements
            </Button>
          )}
          {step === "done" && (
            <Button onClick={handleClose} data-testid="button-sec-done">
              Done
            </Button>
          )}
          {(step === "search" || step === "filings") && (
            <Button variant="ghost" onClick={handleClose} data-testid="button-sec-cancel">
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
