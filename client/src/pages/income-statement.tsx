import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import type { FinancialModel, IncomeStatementLine } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function IncomeStatement() {
  const { data: models, isLoading } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const model = models?.[0];

  const { data: incomeData } = useQuery<IncomeStatementLine[]>({
    queryKey: ["/api/models", model?.id, "income-statement"],
    enabled: !!model,
  });

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  if (!model) {
    return <div className="p-4 text-muted-foreground">No financial model found.</div>;
  }

  const annualData = incomeData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];

  const rows: Array<{
    label: string;
    key: keyof IncomeStatementLine;
    percentKey?: keyof IncomeStatementLine;
    isBold?: boolean;
    isSubtotal?: boolean;
  }> = [
    { label: "Revenue", key: "revenue", isBold: true },
    { label: "COGS", key: "cogs", percentKey: "cogsPercent" },
    { label: "Gross Profit", key: "grossProfit", isBold: true, isSubtotal: true },
    { label: "Sales & Marketing", key: "salesMarketing", percentKey: "smPercent" },
    { label: "Research & Development", key: "researchDevelopment", percentKey: "rdPercent" },
    { label: "General & Administrative", key: "generalAdmin", percentKey: "gaPercent" },
    { label: "Depreciation", key: "depreciation", percentKey: "depreciationPercent" },
    { label: "Total Expenses", key: "totalExpenses", isBold: true, isSubtotal: true },
    { label: "Operating Income", key: "operatingIncome", isBold: true },
    { label: "EBITDA", key: "ebitda", isBold: true },
    { label: "Other Income", key: "otherIncome" },
    { label: "Pre-Tax Income", key: "preTaxIncome", isBold: true },
    { label: "Income Tax", key: "incomeTax", percentKey: "taxRate" },
    { label: "Net Income", key: "netIncome", isBold: true, isSubtotal: true },
    { label: "EPS", key: "eps" },
    { label: "Non-GAAP EPS", key: "nonGaapEps" },
  ];

  const calcYoY = (data: IncomeStatementLine[], idx: number, key: keyof IncomeStatementLine) => {
    if (idx <= 0) return null;
    const current = (data[idx][key] as number) || 0;
    const prior = (data[idx - 1][key] as number) || 0;
    if (!prior) return null;
    return (current - prior) / Math.abs(prior);
  };

  const marginChartData = annualData.map(d => ({
    year: d.year,
    "Gross Margin": d.revenue ? ((d.grossProfit || 0) / d.revenue) * 100 : 0,
    "Operating Margin": d.revenue ? ((d.operatingIncome || 0) / d.revenue) * 100 : 0,
    "Net Margin": d.revenue ? ((d.netIncome || 0) / d.revenue) * 100 : 0,
    "EBITDA Margin": d.revenue ? ((d.ebitda || 0) / d.revenue) * 100 : 0,
  }));

  const revenueGrowthData = annualData.map((d, i) => ({
    year: d.year,
    "Revenue Growth": calcYoY(annualData, i, "revenue") ? (calcYoY(annualData, i, "revenue")! * 100) : 0,
    "Net Income Growth": calcYoY(annualData, i, "netIncome") ? (calcYoY(annualData, i, "netIncome")! * 100) : 0,
  }));

  const latestData = annualData[annualData.length - 1];
  const latestRevenueGrowth = annualData.length >= 2 ? calcYoY(annualData, annualData.length - 1, "revenue") : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Income Statement</h1>
          <p className="text-sm text-muted-foreground">Profit & Loss analysis</p>
        </div>
        <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.revenue || 0) : "--"}</div>
            {latestRevenueGrowth !== null && (
              <p className="text-xs text-muted-foreground">{formatPercent(latestRevenueGrowth)} YoY</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-gross-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.grossProfit || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">
              {latestData?.revenue ? formatPercent((latestData.grossProfit || 0) / latestData.revenue) : "--"} margin
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-operating-income">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.operatingIncome || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">
              {latestData?.revenue ? formatPercent((latestData.operatingIncome || 0) / latestData.revenue) : "--"} margin
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-net-income">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            {latestData && (latestData.netIncome || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.netIncome || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">
              {latestData?.revenue ? formatPercent((latestData.netIncome || 0) / latestData.revenue) : "--"} margin
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" data-testid="tabs-income">
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
          <TabsTrigger value="margins" data-testid="tab-margins">Margin Analysis</TabsTrigger>
          <TabsTrigger value="growth" data-testid="tab-growth">Growth Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table data-testid="table-income-statement">
                <TableHeader>
                  <TableRow>
                    <TableHead>Line Item</TableHead>
                    {annualData.map(d => (
                      <TableHead key={d.year} className="text-right">{d.year}</TableHead>
                    ))}
                    <TableHead className="text-right">% of Rev</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.label} className={row.isSubtotal ? "border-t-2" : ""} data-testid={`row-${row.key}`}>
                      <TableCell className={row.isBold ? "font-bold" : "pl-8"}>{row.label}</TableCell>
                      {annualData.map(d => (
                        <TableCell key={d.year} className={`text-right ${row.isBold ? "font-bold" : ""}`}>
                          {row.key === "eps" || row.key === "nonGaapEps"
                            ? `$${((d[row.key] as number) || 0).toFixed(2)}`
                            : formatCurrency((d[row.key] as number) || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground">
                        {row.percentKey && latestData
                          ? formatPercent((latestData[row.percentKey] as number) || 0)
                          : latestData?.revenue && row.key !== "eps" && row.key !== "nonGaapEps" && row.key !== "revenue"
                            ? formatPercent(((latestData[row.key] as number) || 0) / (latestData.revenue || 1))
                            : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="margins">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Margin Analysis (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={marginChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="Gross Margin" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="EBITDA Margin" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Operating Margin" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Net Margin" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">YoY Growth Rates (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="Revenue Growth" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Net Income Growth" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
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
