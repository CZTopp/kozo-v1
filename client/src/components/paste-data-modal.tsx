import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste, AlertCircle } from "lucide-react";

interface PasteDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldDefs: Array<{ key: string; label: string }>;
  years: number[];
  onImport: (data: Record<number, Record<string, number>>) => void;
  title: string;
  description?: string;
}

export function PasteDataModal({ open, onOpenChange, fieldDefs, years, onImport, title, description }: PasteDataModalProps) {
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<Record<number, Record<string, number>> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = () => {
    try {
      const lines = rawText.trim().split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        setParseError("Need at least a header row and one data row.");
        setParsed(null);
        return;
      }

      const headerCells = lines[0].split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/"/g, ""));
      const yearIndices: Record<number, number> = {};
      for (let i = 1; i < headerCells.length; i++) {
        const yr = parseInt(headerCells[i]);
        if (!isNaN(yr) && years.includes(yr)) {
          yearIndices[yr] = i;
        }
      }

      if (Object.keys(yearIndices).length === 0) {
        setParseError(`No matching years found in header. Expected columns for: ${years.join(", ")}`);
        setParsed(null);
        return;
      }

      const result: Record<number, Record<string, number>> = {};
      for (const yr of Object.keys(yearIndices).map(Number)) {
        result[yr] = {};
      }

      for (let r = 1; r < lines.length; r++) {
        const cells = lines[r].split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/"/g, ""));
        const rowLabel = cells[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";

        const matchedField = fieldDefs.find(f => {
          const fieldNorm = f.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          const keyNorm = f.key.toLowerCase();
          return rowLabel === fieldNorm || rowLabel === keyNorm || fieldNorm.includes(rowLabel) || rowLabel.includes(fieldNorm);
        });

        if (!matchedField) continue;

        for (const [yrStr, colIdx] of Object.entries(yearIndices)) {
          const yr = parseInt(yrStr);
          const rawVal = cells[colIdx] || "0";
          const cleanVal = rawVal.replace(/[$,()%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
          const num = parseFloat(cleanVal);
          if (!isNaN(num)) {
            result[yr][matchedField.key] = num;
          }
        }
      }

      const totalMatched = Object.values(result).reduce((sum, yr) => sum + Object.keys(yr).length, 0);
      if (totalMatched === 0) {
        setParseError("No data could be matched. Check that row labels match the expected line items.");
        setParsed(null);
        return;
      }

      setParsed(result);
      setParseError(null);
    } catch (e: any) {
      setParseError(e.message);
      setParsed(null);
    }
  };

  const handleImport = () => {
    if (parsed) {
      onImport(parsed);
      onOpenChange(false);
      setRawText("");
      setParsed(null);
      setParseError(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setRawText("");
    setParsed(null);
    setParseError(null);
  };

  const matchedYears = parsed ? Object.keys(parsed).map(Number).sort() : [];
  const matchedFields = parsed ? Array.from(new Set(Object.values(parsed).flatMap(yr => Object.keys(yr)))) : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Paste tab-separated or comma-separated data. First column should be line item names, subsequent columns should be years.
            </p>
            <div className="text-xs text-muted-foreground mb-1">Example format:</div>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto mb-2">
{`Line Item\t${years.slice(0, 3).join("\t")}
${fieldDefs[0]?.label || "Revenue"}\t100000\t120000\t140000
${fieldDefs[1]?.label || "COGS"}\t28000\t33600\t39200`}
            </pre>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your data here (from Excel, Google Sheets, or SEC EDGAR)..."
              className="min-h-[120px] font-mono text-xs"
              data-testid="textarea-paste-data"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleParse} variant="outline" disabled={!rawText.trim()} data-testid="button-parse-data">
              Parse Data
            </Button>
            {parseError && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {parseError}
              </div>
            )}
          </div>

          {parsed && matchedFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Preview</span>
                <Badge variant="outline">{matchedFields.length} fields matched</Badge>
                <Badge variant="outline">{matchedYears.length} years</Badge>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line Item</TableHead>
                      {matchedYears.map(yr => (
                        <TableHead key={yr} className="text-right">{yr}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedFields.map(key => {
                      const fieldDef = fieldDefs.find(f => f.key === key);
                      return (
                        <TableRow key={key}>
                          <TableCell className="text-sm">{fieldDef?.label || key}</TableCell>
                          {matchedYears.map(yr => (
                            <TableCell key={yr} className="text-right text-sm font-mono">
                              {parsed[yr]?.[key] !== undefined
                                ? parsed[yr][key].toLocaleString()
                                : <span className="text-muted-foreground">--</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-paste">Cancel</Button>
          <Button onClick={handleImport} disabled={!parsed || matchedFields.length === 0} data-testid="button-import-data">
            Import {matchedFields.length} Fields
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
