import { useQuery } from "@tanstack/react-query";
import { useModel } from "@/lib/model-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import type { ValuationComparison } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Target, ArrowDown } from "lucide-react";

export default function ValuationComparisonPage() {
  const { selectedModel: model, isLoading } = useModel();

  const { data: valData } = useQuery<ValuationComparison[]>({
    queryKey: ["/api/models", model?.id, "valuation-comparison"],
    enabled: !!model,
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">Select a company from the sidebar to begin.</div>;

  const val = valData?.[0];
  const currentPrice = val?.currentSharePrice || 0;
  const averageTarget = val?.averageTarget || 0;
  const percentToTarget = val?.percentToTarget || (currentPrice > 0 ? (averageTarget - currentPrice) / currentPrice : 0);

  const methods = val ? [
    {
      name: "Price/Revenue",
      bullMultiple: `${val.prBullMultiple}x`,
      baseMultiple: `${val.prBaseMultiple}x`,
      bearMultiple: `${val.prBearMultiple}x`,
      bullTarget: val.prBullTarget || 0,
      baseTarget: val.prBaseTarget || 0,
      bearTarget: val.prBearTarget || 0,
    },
    {
      name: "Price/Earnings (PEG)",
      bullMultiple: `${val.peBullPeg}x`,
      baseMultiple: `${val.peBasePeg}x`,
      bearMultiple: `${val.peBearPeg}x`,
      bullTarget: val.peBullTarget || 0,
      baseTarget: val.peBaseTarget || 0,
      bearTarget: val.peBearTarget || 0,
    },
    {
      name: "DCF",
      bullMultiple: "--",
      baseMultiple: "--",
      bearMultiple: "--",
      bullTarget: val.dcfBullTarget || 0,
      baseTarget: val.dcfBaseTarget || 0,
      bearTarget: val.dcfBearTarget || 0,
    },
  ] : [];

  const chartData = methods.map(m => ({
    method: m.name,
    Bull: m.bullTarget,
    Base: m.baseTarget,
    Bear: m.bearTarget,
  }));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Valuation Comparison</h1>
          <p className="text-sm text-muted-foreground">
            Multi-method valuation analysis
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Auto-derived from Revenue, Earnings & DCF
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          <Badge variant={percentToTarget >= 0 ? "default" : "destructive"} data-testid="badge-percent-to-target">
            {percentToTarget >= 0 ? (
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {formatPercent(percentToTarget)} to Target</span>
            ) : (
              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {formatPercent(Math.abs(percentToTarget))} Overvalued</span>
            )}
          </Badge>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowDown className="h-4 w-4 flex-shrink-0" />
            <span>This page is the final output of the cascading model. Price targets are computed from Revenue (P/R method), Earnings (PEG method), and DCF. Edit upstream inputs to see how valuations change.</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-current-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-price">${currentPrice.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-average-target">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-average-target">${averageTarget.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-upside">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% to Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${percentToTarget >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-percent-to-target">
              {formatPercent(percentToTarget)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {methods.map(m => (
          <Card key={m.name} data-testid={`card-method-${m.name.toLowerCase().replace(/[^a-z]/g, "-")}`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">Multiple</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid={`row-${m.name}-bull`}>
                    <TableCell><Badge variant="default">Bull</Badge></TableCell>
                    <TableCell className="text-right">{m.bullMultiple}</TableCell>
                    <TableCell className="text-right font-medium">${m.bullTarget.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow data-testid={`row-${m.name}-base`}>
                    <TableCell><Badge variant="secondary">Base</Badge></TableCell>
                    <TableCell className="text-right">{m.baseMultiple}</TableCell>
                    <TableCell className="text-right font-medium">${m.baseTarget.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow data-testid={`row-${m.name}-bear`}>
                    <TableCell><Badge variant="destructive">Bear</Badge></TableCell>
                    <TableCell className="text-right">{m.bearMultiple}</TableCell>
                    <TableCell className="text-right font-medium">${m.bearTarget.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-testid="card-comparison-chart">
        <CardHeader><CardTitle className="text-sm font-medium">Valuation Methods Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="method" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Bull" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Base" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Bear" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                {currentPrice > 0 && (
                  <ReferenceLine y={currentPrice} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" label={{ value: `Current: $${currentPrice.toFixed(2)}`, fill: "hsl(var(--foreground))", fontSize: 12 }} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
