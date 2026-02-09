import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/calculations";
import type { FinancialModel, CashFlowLine } from "@shared/schema";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, ArrowDown } from "lucide-react";

export default function CashFlow() {
  const { data: models, isLoading } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const model = models?.[0];

  const { data: cfData } = useQuery<CashFlowLine[]>({
    queryKey: ["/api/models", model?.id, "cash-flow"],
    enabled: !!model,
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">No financial model found.</div>;

  const annualData = cfData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];

  const operatingRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "OPERATING ACTIVITIES", key: "operatingCashFlow", isSection: true },
    { label: "Net Income", key: "netIncome" },
    { label: "+ Depreciation", key: "depreciationAdd" },
    { label: "- A/R Change", key: "arChange" },
    { label: "- Inventory Change", key: "inventoryChange" },
    { label: "+ A/P Change", key: "apChange" },
    { label: "Operating Cash Flow", key: "operatingCashFlow", isBold: true, isSubtotal: true },
  ];

  const investingRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "INVESTING ACTIVITIES", key: "investingCashFlow", isSection: true },
    { label: "CapEx", key: "capex" },
    { label: "Investing Cash Flow", key: "investingCashFlow", isBold: true, isSubtotal: true },
  ];

  const financingRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "FINANCING ACTIVITIES", key: "financingCashFlow", isSection: true },
    { label: "ST Debt Change", key: "shortTermDebtChange" },
    { label: "LT Debt Change", key: "longTermDebtChange" },
    { label: "Common Shares Change", key: "commonSharesChange" },
    { label: "Financing Cash Flow", key: "financingCashFlow", isBold: true, isSubtotal: true },
  ];

  const summaryRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isHighlight?: boolean }> = [
    { label: "Net Cash Change", key: "netCashChange", isBold: true, isSubtotal: true },
    { label: "Beginning Cash", key: "beginningCash" },
    { label: "Ending Cash", key: "endingCash", isBold: true },
    { label: "Free Cash Flow", key: "freeCashFlow", isBold: true, isHighlight: true },
  ];

  const allRows = [...operatingRows, ...investingRows, ...financingRows, ...summaryRows];
  const latestData = annualData[annualData.length - 1];

  const fcfChartData = annualData.map(d => ({
    year: d.year,
    "Operating CF": (d.operatingCashFlow || 0) / 1e6,
    "Investing CF": (d.investingCashFlow || 0) / 1e6,
    "Financing CF": (d.financingCashFlow || 0) / 1e6,
    "Free Cash Flow": (d.freeCashFlow || 0) / 1e6,
  }));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Cash Flow Statement</h1>
          <p className="text-sm text-muted-foreground">
            Operating, investing, and financing activities
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Auto-derived from Income Statement & Balance Sheet
            </span>
          </p>
        </div>
        <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowDown className="h-4 w-4 flex-shrink-0" />
            <span>This statement is automatically calculated from the Income Statement (Net Income, Depreciation) and Balance Sheet (working capital changes, CapEx). Edit inputs on those pages to update.</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card data-testid="card-operating-cf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating CF</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.operatingCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-investing-cf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investing CF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.investingCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-financing-cf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financing CF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.financingCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-fcf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Cash Flow</CardTitle>
            {latestData && (latestData.freeCashFlow || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fcf">{latestData ? formatCurrency(latestData.freeCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" data-testid="tabs-cash-flow">
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
          <TabsTrigger value="chart" data-testid="tab-chart">FCF Trend</TabsTrigger>
          <TabsTrigger value="breakdown" data-testid="tab-breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table data-testid="table-cash-flow">
                <TableHeader>
                  <TableRow>
                    <TableHead>Line Item</TableHead>
                    {annualData.map(d => <TableHead key={d.year} className="text-right">{d.year}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.map((row, idx) => {
                    if ("isSection" in row && row.isSection) {
                      return (
                        <TableRow key={`section-${row.label}-${idx}`} className="bg-muted/50">
                          <TableCell colSpan={annualData.length + 1} className="font-bold text-sm">{row.label}</TableCell>
                        </TableRow>
                      );
                    }
                    const isHighlight = "isHighlight" in row && row.isHighlight;
                    return (
                      <TableRow key={`${row.key}-${idx}`} className={`${row.isSubtotal ? "border-t-2" : ""} ${isHighlight ? "bg-muted/30" : ""}`} data-testid={`row-${row.key}`}>
                        <TableCell className={row.isBold ? "font-bold" : "pl-8"}>{row.label}</TableCell>
                        {annualData.map(d => (
                          <TableCell key={d.year} className={`text-right ${row.isBold ? "font-bold" : ""} ${isHighlight ? "text-green-600 dark:text-green-400 font-bold" : ""}`}>
                            {formatCurrency((d[row.key] as number) || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Free Cash Flow Trend ($M)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fcfChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                    <Legend />
                    <Line type="monotone" dataKey="Free Cash Flow" stroke="hsl(var(--chart-1))" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Cash Flow Breakdown ($M)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fcfChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                    <Legend />
                    <Bar dataKey="Operating CF" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Investing CF" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Financing CF" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
