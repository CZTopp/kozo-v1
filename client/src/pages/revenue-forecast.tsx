import { Fragment, useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useModel } from "@/lib/model-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPercent } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RevenueLineItem, RevenuePeriod } from "@shared/schema";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, DollarSign, Save, RefreshCw, ArrowRight, Plus, Trash2, Pencil, Sparkles, Settings2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const UNIT_MULTIPLIERS: Record<string, number> = {
  ones: 1,
  thousands: 1e3,
  millions: 1e6,
  billions: 1e9,
  trillions: 1e12,
};

const UNIT_LABELS: Record<string, string> = {
  ones: "$",
  thousands: "$K",
  millions: "$M",
  billions: "$B",
  trillions: "$T",
};

const UNIT_SHORT: Record<string, string> = {
  ones: "",
  thousands: "K",
  millions: "M",
  billions: "B",
  trillions: "T",
};

function formatWithUnit(val: number, unit: string, decimals = 1): string {
  const mult = UNIT_MULTIPLIERS[unit] || 1;
  const scaled = val / mult;
  if (unit === "ones") {
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  }
  const suffix = UNIT_SHORT[unit] || "";
  return `$${scaled.toFixed(decimals)}${suffix}`;
}

function parseWithUnit(input: string, unit: string): number {
  const cleaned = input.replace(/[$,\s]/g, "").replace(/[KkMmBbTt]$/, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  const mult = UNIT_MULTIPLIERS[unit] || 1;
  return num * mult;
}

function displayForInput(val: number, unit: string): string {
  const mult = UNIT_MULTIPLIERS[unit] || 1;
  const scaled = val / mult;
  if (scaled === 0) return "";
  const rounded = Math.round(scaled * 100) / 100;
  return rounded.toString();
}

export default function RevenueForecast() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<Record<string, number>>({});
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  const [editedYears, setEditedYears] = useState<Record<number, number>>({});
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [newLineItems, setNewLineItems] = useState<Array<{ tempId: string; name: string }>>([]);
  const [newLineItemPeriods, setNewLineItemPeriods] = useState<Record<string, Record<string, number>>>({});
  const [showProjectionSettings, setShowProjectionSettings] = useState(false);
  const [projectionSettings, setProjectionSettings] = useState<{
    growthDecayRate: number;
    targetNetMargin: number | null;
    scenarioBullMultiplier: number;
    scenarioBaseMultiplier: number;
    scenarioBearMultiplier: number;
  } | null>(null);

  const { selectedModel: model, isLoading: modelsLoading } = useModel();

  const displayUnit = (model as any)?.displayUnit || "ones";
  const MAX_QUARTERLY_YEARS = 6;

  const { data: lineItems } = useQuery<RevenueLineItem[]>({
    queryKey: ["/api/models", model?.id, "revenue-line-items"],
    enabled: !!model,
  });

  const { data: periods } = useQuery<RevenuePeriod[]>({
    queryKey: ["/api/models", model?.id, "revenue-periods"],
    enabled: !!model,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedPeriods).map(([id, amount]) =>
        apiRequest("PATCH", `/api/revenue-periods/${id}`, { amount })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models", model?.id, "revenue-periods"] });
      setEditedPeriods({});
      toast({ title: "Revenue saved", description: "Revenue periods updated successfully." });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const deleteIds = Array.from(pendingDeletes);
      for (const id of deleteIds) {
        await apiRequest("DELETE", `/api/revenue-line-items/${id}`);
      }

      const nameUpdates = Object.entries(editedNames).map(([id, name]) =>
        apiRequest("PATCH", `/api/revenue-line-items/${id}`, { name })
      );
      await Promise.all(nameUpdates);

      for (const newItem of newLineItems) {
        const created = await apiRequest("POST", `/api/models/${model!.id}/revenue-line-items-with-periods`, {
          name: newItem.name,
          sortOrder: (lineItems?.length || 0) + newLineItems.indexOf(newItem),
        });
        const createdItem = await created.json();
        const itemPeriods = newLineItemPeriods[newItem.tempId];
        if (itemPeriods && createdItem?.id) {
          const periodsRes = await apiRequest("GET", `/api/models/${model!.id}/revenue-periods`);
          const freshPeriods = await periodsRes.json() as RevenuePeriod[];
          const newPeriods = freshPeriods.filter((p: RevenuePeriod) => p.lineItemId === createdItem.id);
          const periodUpdates: Promise<Response>[] = [];
          for (const p of newPeriods) {
            const qKey = `${p.year}-Q${p.quarter}`;
            const aKey = `${p.year}-A`;
            if (itemPeriods[qKey] !== undefined && itemPeriods[qKey] !== 0) {
              periodUpdates.push(apiRequest("PATCH", `/api/revenue-periods/${p.id}`, { amount: itemPeriods[qKey] }));
            } else if (itemPeriods[aKey] !== undefined && itemPeriods[aKey] !== 0) {
              periodUpdates.push(apiRequest("PATCH", `/api/revenue-periods/${p.id}`, { amount: itemPeriods[aKey] / 4 }));
            }
          }
          await Promise.all(periodUpdates);
        }
      }

      const periodUpdates = Object.entries(editedPeriods).map(([id, amount]) =>
        apiRequest("PATCH", `/api/revenue-periods/${id}`, { amount })
      );
      await Promise.all(periodUpdates);

      if (Object.keys(editedYears).length > 0) {
        const yearMapping: Record<number, number> = {};
        years.forEach(y => { yearMapping[y] = editedYears[y] !== undefined ? editedYears[y] : y; });
        const mappedYears = years.map(y => yearMapping[y]);
        const newStartYear = Math.min(...mappedYears);
        const newEndYear = Math.max(...mappedYears);
        await apiRequest("PATCH", `/api/models/${model!.id}/update-years`, {
          yearMapping,
          startYear: newStartYear,
          endYear: newEndYear,
        });
      }

      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "revenue-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "revenue-line-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "assumptions"] });
      setEditMode(false);
      setEditedPeriods({});
      setEditedNames({});
      setEditedYears({});
      setPendingDeletes(new Set());
      setNewLineItems([]);
      setNewLineItemPeriods({});
      toast({ title: "Model recalculated", description: "All financial statements have been updated from your revenue changes." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/models/${model!.id}/forecast-forward`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "revenue-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "revenue-line-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "assumptions"] });
      const yrs = data?.forecastedYears?.join(", ") || "missing quarters";
      const count = data?.periodsCreated || 0;
      toast({ title: "Projections complete", description: `Filled ${count} period(s) across ${yrs}. All financial statements updated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Forecast failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (model && !projectionSettings) {
      setProjectionSettings({
        growthDecayRate: model.growthDecayRate ?? 0,
        targetNetMargin: model.targetNetMargin ?? null,
        scenarioBullMultiplier: model.scenarioBullMultiplier ?? 1.2,
        scenarioBaseMultiplier: model.scenarioBaseMultiplier ?? 1.0,
        scenarioBearMultiplier: model.scenarioBearMultiplier ?? 0.8,
      });
    }
  }, [model?.id]);

  const saveProjectionSettingsMutation = useMutation({
    mutationFn: async (settings: typeof projectionSettings) => {
      if (!model || !settings) return;
      await apiRequest("PATCH", `/api/models/${model.id}`, {
        growthDecayRate: settings.growthDecayRate,
        targetNetMargin: settings.targetNetMargin,
        scenarioBullMultiplier: settings.scenarioBullMultiplier,
        scenarioBaseMultiplier: settings.scenarioBaseMultiplier,
        scenarioBearMultiplier: settings.scenarioBearMultiplier,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Settings saved", description: "Projection parameters updated. Click Forecast Forward to apply." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (modelsLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">Select a company from the sidebar to begin.</div>;

  const years = Array.from({ length: model.endYear - model.startYear + 1 }, (_, i) => model.startYear + i);
  const quarterlyYears = years.slice(0, MAX_QUARTERLY_YEARS);
  const annualOnlyYears = years.slice(MAX_QUARTERLY_YEARS);

  const getPeriod = (lineItemId: string, year: number, quarter: number | null): RevenuePeriod | undefined => {
    if (quarter === null) {
      return periods?.find(p => p.lineItemId === lineItemId && p.year === year && (p.quarter === null || p.quarter === undefined));
    }
    return periods?.find(p => p.lineItemId === lineItemId && p.year === year && p.quarter === quarter);
  };

  const getEditedAmount = (periodId: string, original: number): number => {
    return editedPeriods[periodId] !== undefined ? editedPeriods[periodId] : original;
  };

  const getQuarterlyAmount = (lineItemId: string, year: number, quarter: number) => {
    const p = getPeriod(lineItemId, year, quarter);
    if (!p) return 0;
    return getEditedAmount(p.id, p.amount || 0);
  };

  const getAnnualTotal = (lineItemId: string, year: number) => {
    let total = 0;
    for (let q = 1; q <= 4; q++) {
      total += getQuarterlyAmount(lineItemId, year, q);
    }
    return total;
  };

  const getNewItemQuarterlyAmount = (tempId: string, year: number, quarter: number) => {
    const key = `${year}-Q${quarter}`;
    return newLineItemPeriods[tempId]?.[key] || 0;
  };

  const getNewItemAnnualTotal = (tempId: string, year: number) => {
    if (annualOnlyYears.includes(year)) {
      const key = `${year}-A`;
      return newLineItemPeriods[tempId]?.[key] || 0;
    }
    let total = 0;
    for (let q = 1; q <= 4; q++) {
      total += getNewItemQuarterlyAmount(tempId, year, q);
    }
    return total;
  };

  const visibleLineItems = lineItems?.filter(li => !pendingDeletes.has(li.id)) || [];

  const hasGapsToForecast = (() => {
    if (!periods || !lineItems || lineItems.length === 0) return false;
    const hasAnyData = periods.some(p => (p.amount || 0) > 0);
    if (!hasAnyData) return false;
    for (const li of visibleLineItems) {
      const streamHasData = periods.some(p => p.lineItemId === li.id && (p.amount || 0) > 0);
      if (!streamHasData) continue;
      for (const yr of years) {
        for (let q = 1; q <= 4; q++) {
          const p = periods.find(p => p.lineItemId === li.id && p.year === yr && p.quarter === q);
          if (!p || (p.amount || 0) === 0) return true;
        }
      }
    }
    return false;
  })();

  const hasNoRevenueData = !periods || periods.length === 0 || !periods.some(p => (p.amount || 0) > 0);

  const getTotalRevenue = (year: number) => {
    let total = visibleLineItems.reduce((sum, li) => sum + getAnnualTotal(li.id, year), 0);
    newLineItems.forEach(ni => { total += getNewItemAnnualTotal(ni.tempId, year); });
    return total;
  };

  const getQuarterTotal = (year: number, quarter: number) => {
    let total = 0;
    visibleLineItems.forEach(li => { total += getQuarterlyAmount(li.id, year, quarter); });
    newLineItems.forEach(ni => { total += getNewItemQuarterlyAmount(ni.tempId, year, quarter); });
    return total;
  };

  const calcYoYGrowth = (year: number) => {
    const current = getTotalRevenue(year);
    const prior = getTotalRevenue(year - 1);
    if (!prior || prior === 0) return null;
    return (current - prior) / Math.abs(prior);
  };

  const calcStreamYoYGrowth = (lineItemId: string, year: number) => {
    const current = getAnnualTotal(lineItemId, year);
    const prior = getAnnualTotal(lineItemId, year - 1);
    if (!prior || prior === 0) return null;
    return (current - prior) / Math.abs(prior);
  };

  const calcStreamQoQGrowth = (lineItemId: string, year: number, quarter: number) => {
    const current = getQuarterlyAmount(lineItemId, year, quarter);
    let prior: number;
    if (quarter === 1) {
      prior = getQuarterlyAmount(lineItemId, year - 1, 4);
    } else {
      prior = getQuarterlyAmount(lineItemId, year, quarter - 1);
    }
    if (!prior || prior === 0) return null;
    return (current - prior) / Math.abs(prior);
  };

  const calcStreamQYoYGrowth = (lineItemId: string, year: number, quarter: number) => {
    const current = getQuarterlyAmount(lineItemId, year, quarter);
    const prior = getQuarterlyAmount(lineItemId, year - 1, quarter);
    if (!prior || prior === 0) return null;
    return (current - prior) / Math.abs(prior);
  };

  const handleQYoYEdit = (lineItemId: string, year: number, quarter: number, yoyPercent: string) => {
    const pct = parseFloat(yoyPercent);
    if (isNaN(pct)) return;
    const priorAmt = getQuarterlyAmount(lineItemId, year - 1, quarter);
    if (priorAmt === 0) return;
    const newAmount = priorAmt * (1 + pct / 100);
    const period = getPeriod(lineItemId, year, quarter);
    if (period) {
      setEditedPeriods(prev => ({ ...prev, [period.id]: newAmount }));
    }
  };

  const calcStreamPercentOfTotal = (lineItemId: string, year: number) => {
    const total = getTotalRevenue(year);
    if (!total || total === 0) return null;
    return getAnnualTotal(lineItemId, year) / total;
  };

  const calcStreamQPercentOfTotal = (lineItemId: string, year: number, quarter: number) => {
    const total = getQuarterTotal(year, quarter);
    if (!total || total === 0) return null;
    return getQuarterlyAmount(lineItemId, year, quarter) / total;
  };

  const handleEdit = (periodId: string, value: string) => {
    const num = parseWithUnit(value, displayUnit);
    setEditedPeriods(prev => ({ ...prev, [periodId]: num }));
  };

  const handleAnnualEdit = (lineItemId: string, year: number, value: string) => {
    const total = parseWithUnit(value, displayUnit);
    const perQuarter = total / 4;
    const updates: Record<string, number> = {};
    for (let q = 1; q <= 4; q++) {
      const p = getPeriod(lineItemId, year, q);
      if (p) {
        updates[p.id] = perQuarter;
      }
    }
    setEditedPeriods(prev => ({ ...prev, ...updates }));
  };

  const handleAnnualYoyEdit = (lineItemId: string, year: number, yoyPercent: string) => {
    const pct = parseFloat(yoyPercent);
    if (isNaN(pct)) return;
    const priorTotal = getAnnualTotal(lineItemId, year - 1);
    if (priorTotal === 0) return;
    const newTotal = priorTotal * (1 + pct / 100);
    const perQuarter = newTotal / 4;
    const updates: Record<string, number> = {};
    for (let q = 1; q <= 4; q++) {
      const p = getPeriod(lineItemId, year, q);
      if (p) {
        updates[p.id] = perQuarter;
      }
    }
    setEditedPeriods(prev => ({ ...prev, ...updates }));
  };

  const handleNewItemEdit = (tempId: string, year: number, quarter: number | null, value: string) => {
    const num = parseWithUnit(value, displayUnit);
    const key = quarter ? `${year}-Q${quarter}` : `${year}-A`;
    setNewLineItemPeriods(prev => ({
      ...prev,
      [tempId]: { ...(prev[tempId] || {}), [key]: num },
    }));
  };

  const handleNameEdit = (id: string, name: string) => {
    setEditedNames(prev => ({ ...prev, [id]: name }));
  };

  const handleDelete = (id: string) => {
    setPendingDeletes(prev => new Set(prev).add(id));
  };

  const handleUndoDelete = (id: string) => {
    setPendingDeletes(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAddLineItem = () => {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNewLineItems(prev => [...prev, { tempId, name: "" }]);
  };

  const handleRemoveNewLineItem = (tempId: string) => {
    setNewLineItems(prev => prev.filter(li => li.tempId !== tempId));
    setNewLineItemPeriods(prev => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const handleNewItemNameChange = (tempId: string, name: string) => {
    setNewLineItems(prev => prev.map(li => li.tempId === tempId ? { ...li, name } : li));
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditedPeriods({});
    setEditedNames({});
    setEditedYears({});
    setPendingDeletes(new Set());
    setNewLineItems([]);
    setNewLineItemPeriods({});
  };

  const hasEdits = Object.keys(editedPeriods).length > 0 ||
    Object.keys(editedNames).length > 0 ||
    Object.keys(editedYears).length > 0 ||
    pendingDeletes.size > 0 ||
    newLineItems.some(ni => ni.name.trim() !== "");

  const getDisplayYear = (originalYear: number): number => {
    return editedYears[originalYear] !== undefined ? editedYears[originalYear] : originalYear;
  };

  const handleYearEdit = (originalYear: number, value: string) => {
    const parsed = parseInt(value);
    if (isNaN(parsed)) return;
    if (parsed === originalYear) {
      setEditedYears(prev => {
        const next = { ...prev };
        delete next[originalYear];
        return next;
      });
    } else {
      setEditedYears(prev => ({ ...prev, [originalYear]: parsed }));
    }
  };

  const getLineItemName = (li: RevenueLineItem) => {
    return editedNames[li.id] !== undefined ? editedNames[li.id] : li.name;
  };

  const annualChartData = years.map(year => {
    const entry: Record<string, number | string> = { year };
    visibleLineItems.forEach(li => { entry[getLineItemName(li)] = getAnnualTotal(li.id, year); });
    newLineItems.filter(ni => ni.name.trim()).forEach(ni => { entry[ni.name] = getNewItemAnnualTotal(ni.tempId, year); });
    return entry;
  });

  const allNames = [
    ...visibleLineItems.map(li => getLineItemName(li)),
    ...newLineItems.filter(ni => ni.name.trim()).map(ni => ni.name),
  ];

  const quarterlyChartData: Array<Record<string, number | string>> = [];
  quarterlyYears.forEach(year => {
    for (let q = 1; q <= 4; q++) {
      const entry: Record<string, number | string> = { period: `${year} Q${q}` };
      visibleLineItems.forEach(li => { entry[getLineItemName(li)] = getQuarterlyAmount(li.id, year, q); });
      newLineItems.filter(ni => ni.name.trim()).forEach(ni => { entry[ni.name] = getNewItemQuarterlyAmount(ni.tempId, year, q); });
      quarterlyChartData.push(entry);
    }
  });

  const totalColSpan = quarterlyYears.length * 4 + annualOnlyYears.length + 1 + (editMode ? 1 : 0);

  const renderYoYPct = (g: number | null) => {
    if (g === null) return <span className="text-xs text-muted-foreground">--</span>;
    return (
      <span className={`text-[10px] font-medium inline-flex items-center gap-0.5 ${g >= 0 ? "text-emerald-500" : "text-red-500"}`}>
        {g >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        {formatPercent(g)}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Revenue Forecast</h1>
          <p className="text-sm text-muted-foreground">
            Revenue streams &mdash; {years.length} year model
            {annualOnlyYears.length > 0 && ` (${quarterlyYears.length}yr quarterly + ${annualOnlyYears.length}yr annual)`}
            {displayUnit !== "ones" && (
              <Badge variant="secondary" className="ml-2">{UNIT_LABELS[displayUnit]}</Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={cancelEdit}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => recalcMutation.mutate()}
                disabled={!hasEdits || recalcMutation.isPending}
                data-testid="button-save-recalculate"
              >
                {recalcMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Recalculating...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Save & Recalculate</>
                )}
              </Button>
            </>
          ) : (
            <>
              {hasGapsToForecast && (
                <>
                  <InfoTooltip content="Auto-projects revenue into empty future years based on historical average growth rates and decay settings. Cascades through all financial statements." />
                  <Button
                    variant="default"
                    onClick={() => forecastMutation.mutate()}
                    disabled={forecastMutation.isPending}
                    data-testid="button-forecast-forward"
                  >
                    {forecastMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Projecting...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-1" /> Forecast Forward</>
                    )}
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-revenue">
                <Pencil className="h-4 w-4 mr-1" /> Edit Revenue
              </Button>
            </>
          )}
        </div>
      </div>

      {editMode && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              <span>
{`Enter values in ${UNIT_LABELS[displayUnit]} (decimals accepted). Edit YoY % to auto-calculate amounts from prior year. Changes cascade through all downstream statements.`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {hasNoRevenueData && !editMode && (
        <Card className="border-dashed" data-testid="card-revenue-warning">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>No revenue data entered yet. Click "Edit Revenue" to add quarterly revenue for each stream, or use "Forecast Forward" after entering at least one quarter of data.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!editMode && (
        <Card data-testid="card-projection-settings">
          <CardHeader
            className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2 cursor-pointer"
            onClick={() => setShowProjectionSettings(!showProjectionSettings)}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium flex items-center gap-1">Projection Settings <InfoTooltip content="Advanced settings that control how revenue projections behave." /></CardTitle>
            </div>
            {showProjectionSettings ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          {showProjectionSettings && projectionSettings && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Growth Model</h4>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">Growth Decay Rate <InfoTooltip content="Controls how quickly revenue growth decelerates in projected years." /></Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={projectionSettings.growthDecayRate}
                        onChange={(e) => setProjectionSettings({
                          ...projectionSettings,
                          growthDecayRate: parseFloat(e.target.value) || 0,
                        })}
                        className="w-24"
                        data-testid="input-growth-decay"
                      />
                      <span className="text-xs text-muted-foreground">
                        ({(projectionSettings.growthDecayRate * 100).toFixed(0)}% annual decay)
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">Target Net Margin <InfoTooltip content="If set, cost assumptions converge toward this net margin." /></Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="-1"
                        max="1"
                        value={projectionSettings.targetNetMargin ?? ""}
                        placeholder="None"
                        onChange={(e) => setProjectionSettings({
                          ...projectionSettings,
                          targetNetMargin: e.target.value === "" ? null : (parseFloat(e.target.value) || 0),
                        })}
                        className="w-24"
                        data-testid="input-target-margin"
                      />
                      <span className="text-xs text-muted-foreground">
                        {projectionSettings.targetNetMargin !== null
                          ? `(${(projectionSettings.targetNetMargin * 100).toFixed(0)}% target)`
                          : "(disabled)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Scenario Multipliers</h4>
                  <p className="text-xs text-muted-foreground">Multiplied against the base growth rate to generate bull/base/bear revenue projections.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-green-500 flex items-center gap-1">Bull Case <InfoTooltip content="Multiplier for bull-case revenue projections." /></Label>
                      <Input
                        type="number" step="0.05" min="0.1" max="5"
                        value={projectionSettings.scenarioBullMultiplier}
                        onChange={(e) => setProjectionSettings({ ...projectionSettings, scenarioBullMultiplier: parseFloat(e.target.value) || 1 })}
                        data-testid="input-bull-multiplier"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">Base Case</Label>
                      <Input
                        type="number" step="0.05" min="0.1" max="5"
                        value={projectionSettings.scenarioBaseMultiplier}
                        onChange={(e) => setProjectionSettings({ ...projectionSettings, scenarioBaseMultiplier: parseFloat(e.target.value) || 1 })}
                        data-testid="input-base-multiplier"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-red-500 flex items-center gap-1">Bear Case</Label>
                      <Input
                        type="number" step="0.05" min="0.1" max="5"
                        value={projectionSettings.scenarioBearMultiplier}
                        onChange={(e) => setProjectionSettings({ ...projectionSettings, scenarioBearMultiplier: parseFloat(e.target.value) || 1 })}
                        data-testid="input-bear-multiplier"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => saveProjectionSettingsMutation.mutate(projectionSettings)}
                  disabled={saveProjectionSettingsMutation.isPending}
                  data-testid="button-save-projection-settings"
                >
                  {saveProjectionSettingsMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Save Settings</>
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {years.slice(-3).map(year => (
          <Card key={year} data-testid={`card-revenue-${year}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                {year} Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-revenue-${year}`}>{formatWithUnit(getTotalRevenue(year), displayUnit)}</div>
              {calcYoYGrowth(year) !== null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span data-testid={`text-growth-${year}`}>{formatPercent(calcYoYGrowth(year)!)} YoY</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="quarterly" data-testid="tabs-revenue">
        <TabsList>
          <TabsTrigger value="quarterly" data-testid="tab-quarterly">Quarterly Detail</TabsTrigger>
          <TabsTrigger value="table" data-testid="tab-table">Annual Summary</TabsTrigger>
          <TabsTrigger value="annual-chart" data-testid="tab-annual-chart">Annual Chart</TabsTrigger>
          <TabsTrigger value="annual-trend" data-testid="tab-annual-trend">Annual Trend</TabsTrigger>
          <TabsTrigger value="quarterly-chart" data-testid="tab-quarterly-chart">Quarterly Trend</TabsTrigger>
        </TabsList>

        <TabsContent value="quarterly">
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table data-testid="table-quarterly-revenue">
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="min-w-[180px] align-bottom sticky left-0 bg-card z-10">Revenue Stream</TableHead>
                      {quarterlyYears.map(year => (
                        <TableHead key={`year-${year}`} colSpan={4} className="text-center text-xs border-b-0">
                          {editMode ? (
                            <Input
                              type="number"
                              value={getDisplayYear(year)}
                              onChange={(e) => handleYearEdit(year, e.target.value)}
                              className={`h-7 text-xs text-center w-20 mx-auto ${editedYears[year] !== undefined ? "border-blue-500" : ""}`}
                              data-testid={`input-year-${year}`}
                            />
                          ) : (
                            <span data-testid={`text-year-${year}`}>{year}</span>
                          )}
                        </TableHead>
                      ))}
                      {annualOnlyYears.map(year => (
                        <TableHead key={`year-${year}`} rowSpan={2} className="text-center text-xs align-bottom min-w-[90px]">
                          {editMode ? (
                            <Input
                              type="number"
                              value={getDisplayYear(year)}
                              onChange={(e) => handleYearEdit(year, e.target.value)}
                              className={`h-7 text-xs text-center w-20 mx-auto ${editedYears[year] !== undefined ? "border-blue-500" : ""}`}
                              data-testid={`input-year-${year}`}
                            />
                          ) : (
                            <span data-testid={`text-year-${year}`}>{year}<br /><span className="text-muted-foreground text-[10px]">Annual</span></span>
                          )}
                        </TableHead>
                      ))}
                      {editMode && <TableHead rowSpan={2} className="w-[50px] align-bottom" />}
                    </TableRow>
                    <TableRow>
                      {quarterlyYears.map(year => (
                        [1, 2, 3, 4].map(q => (
                          <TableHead key={`${year}-Q${q}`} className="text-right text-xs min-w-[85px]">
                            Q{q}
                          </TableHead>
                        ))
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleLineItems.map((li, liIdx) => (
                      <Fragment key={li.id}>
                        <TableRow data-testid={`row-revenue-${li.id}`}>
                          <TableCell className="font-medium text-sm sticky left-0 bg-card z-10">
                            <div className="flex items-center gap-1">
                              {editMode ? (
                                <Input
                                  type="text"
                                  value={getLineItemName(li)}
                                  onChange={(e) => handleNameEdit(li.id, e.target.value)}
                                  className="h-7 text-sm"
                                  data-testid={`input-name-${li.id}`}
                                />
                              ) : (
                                <>{li.name}</>
                              )}
                            </div>
                          </TableCell>
                          {quarterlyYears.map(year =>
                            [1, 2, 3, 4].map(q => {
                              const period = getPeriod(li.id, year, q);
                              const amt = period ? getEditedAmount(period.id, period.amount || 0) : 0;
                              const isEdited = period && editedPeriods[period.id] !== undefined;
                              const qoq = calcStreamQoQGrowth(li.id, year, q);
                              const yoy = calcStreamQYoYGrowth(li.id, year, q);
                              const pctOfTotal = calcStreamQPercentOfTotal(li.id, year, q);
                              return (
                                <TableCell key={`${year}-Q${q}`} className="text-right p-1">
                                  <div>
                                    {editMode && period ? (
                                      <Input
                                        type="text"
                                        value={displayForInput(amt, displayUnit)}
                                        onChange={(e) => handleEdit(period.id, e.target.value)}
                                        className={`h-6 text-xs text-right ${isEdited ? "border-blue-500" : ""}`}
                                        data-testid={`input-revenue-${li.id}-${year}-Q${q}`}
                                      />
                                    ) : (
                                      <span className="text-xs">{formatWithUnit(amt, displayUnit)}</span>
                                    )}
                                    <div className="flex flex-col items-end mt-0.5">
                                      {qoq !== null && (
                                        <span className={`text-[10px] ${qoq >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                          {formatPercent(qoq)} QoQ
                                        </span>
                                      )}
                                      {editMode && period ? (
                                        yoy !== null || getQuarterlyAmount(li.id, year - 1, q) > 0 ? (
                                          <div className="flex items-center gap-0.5 justify-end">
                                            <Input
                                              type="number"
                                              step="0.1"
                                              value={yoy !== null ? (yoy * 100).toFixed(1) : ""}
                                              onChange={(e) => handleQYoYEdit(li.id, year, q, e.target.value)}
                                              className="h-5 w-14 text-[10px] text-right p-0.5"
                                              data-testid={`input-yoy-${li.id}-${year}-Q${q}`}
                                            />
                                            <span className="text-[10px] text-muted-foreground">YoY</span>
                                          </div>
                                        ) : null
                                      ) : (
                                        yoy !== null && (
                                          <span className={`text-[10px] ${yoy >= 0 ? "text-blue-500" : "text-orange-500"}`}>
                                            {formatPercent(yoy)} YoY
                                          </span>
                                        )
                                      )}
                                      {pctOfTotal !== null && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatPercent(pctOfTotal)} of total
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            })
                          )}
                          {annualOnlyYears.map(year => {
                            const annualAmt = getAnnualTotal(li.id, year);
                            const hasAnyEdited = [1,2,3,4].some(q => {
                              const p = getPeriod(li.id, year, q);
                              return p && editedPeriods[p.id] !== undefined;
                            });
                            const hasAnyPeriod = [1,2,3,4].some(q => getPeriod(li.id, year, q));
                            const priorAmt = getAnnualTotal(li.id, year - 1);
                            const yoyGrowth = calcStreamYoYGrowth(li.id, year);
                            const pctOfTotal = calcStreamPercentOfTotal(li.id, year);
                            return (
                              <TableCell key={`${year}-A`} className="text-right p-1">
                                <div>
                                  {editMode && hasAnyPeriod ? (
                                    <Input
                                      type="text"
                                      value={displayForInput(annualAmt, displayUnit)}
                                      onChange={(e) => handleAnnualEdit(li.id, year, e.target.value)}
                                      className={`h-6 text-xs text-right ${hasAnyEdited ? "border-blue-500" : ""}`}
                                      data-testid={`input-revenue-${li.id}-${year}-A`}
                                    />
                                  ) : (
                                    <span className="text-xs">{formatWithUnit(annualAmt, displayUnit)}</span>
                                  )}
                                  <div className="flex flex-col items-end mt-0.5">
                                    {editMode && hasAnyPeriod ? (
                                      priorAmt > 0 ? (
                                        <div className="flex items-center gap-0.5 justify-end">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            value={yoyGrowth !== null ? (yoyGrowth * 100).toFixed(1) : ""}
                                            onChange={(e) => handleAnnualYoyEdit(li.id, year, e.target.value)}
                                            className="h-5 w-14 text-[10px] text-right p-0.5"
                                            data-testid={`input-yoy-${li.id}-${year}-A`}
                                          />
                                          <span className="text-[10px] text-muted-foreground">YoY</span>
                                        </div>
                                      ) : null
                                    ) : (
                                      yoyGrowth !== null && (
                                        <span className={`text-[10px] ${yoyGrowth >= 0 ? "text-blue-500" : "text-orange-500"}`}>
                                          {formatPercent(yoyGrowth)} YoY
                                        </span>
                                      )
                                    )}
                                    {pctOfTotal !== null && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatPercent(pctOfTotal)} of total
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            );
                          })}
                          {editMode && (
                            <TableCell className="p-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(li.id)}
                                data-testid={`button-delete-${li.id}`}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      </Fragment>
                    ))}

                    {editMode && pendingDeletes.size > 0 && lineItems?.filter(li => pendingDeletes.has(li.id)).map(li => (
                      <TableRow key={`deleted-${li.id}`} className="opacity-40 line-through">
                        <TableCell className="font-medium text-sm text-muted-foreground sticky left-0 bg-card z-10">{li.name}</TableCell>
                        {quarterlyYears.map(year =>
                          [1, 2, 3, 4].map(q => (
                            <TableCell key={`${year}-Q${q}`} className="text-right p-1">
                              <span className="text-xs text-muted-foreground">--</span>
                            </TableCell>
                          ))
                        )}
                        {annualOnlyYears.map(year => (
                          <TableCell key={`${year}-A`} className="text-right p-1">
                            <span className="text-xs text-muted-foreground">--</span>
                          </TableCell>
                        ))}
                        <TableCell className="p-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleUndoDelete(li.id)}
                            data-testid={`button-undo-delete-${li.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {editMode && newLineItems.map(ni => (
                      <TableRow key={ni.tempId} className="bg-muted/30" data-testid={`row-new-${ni.tempId}`}>
                        <TableCell className="font-medium text-sm sticky left-0 bg-muted/30 z-10">
                          <Input
                            type="text"
                            value={ni.name}
                            onChange={(e) => handleNewItemNameChange(ni.tempId, e.target.value)}
                            placeholder="New revenue stream name"
                            className="h-7 text-sm"
                            data-testid={`input-new-name-${ni.tempId}`}
                          />
                        </TableCell>
                        {quarterlyYears.map(year =>
                          [1, 2, 3, 4].map(q => {
                            const key = `${year}-Q${q}`;
                            const amt = newLineItemPeriods[ni.tempId]?.[key] || 0;
                            return (
                              <TableCell key={key} className="text-right p-1">
                                <Input
                                  type="text"
                                  value={displayForInput(amt, displayUnit)}
                                  onChange={(e) => handleNewItemEdit(ni.tempId, year, q, e.target.value)}
                                  placeholder="0"
                                  className="h-7 text-xs text-right"
                                  data-testid={`input-new-revenue-${ni.tempId}-${year}-Q${q}`}
                                />
                              </TableCell>
                            );
                          })
                        )}
                        {annualOnlyYears.map(year => {
                          const key = `${year}-A`;
                          const amt = newLineItemPeriods[ni.tempId]?.[key] || 0;
                          return (
                            <TableCell key={key} className="text-right p-1">
                              <Input
                                type="text"
                                value={displayForInput(amt, displayUnit)}
                                onChange={(e) => handleNewItemEdit(ni.tempId, year, null, e.target.value)}
                                placeholder="0"
                                className="h-7 text-xs text-right"
                                data-testid={`input-new-revenue-${ni.tempId}-${year}-A`}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell className="p-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveNewLineItem(ni.tempId)}
                            data-testid={`button-remove-new-${ni.tempId}`}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {editMode && (
                      <TableRow>
                        <TableCell colSpan={totalColSpan}>
                          <Button
                            variant="outline"
                            onClick={handleAddLineItem}
                            className="w-full border-dashed"
                            data-testid="button-add-line-item"
                          >
                            <Plus className="h-4 w-4 mr-1" /> Add Revenue Stream
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow className="font-bold border-t-2">
                      <TableCell className="sticky left-0 bg-card z-10">Total</TableCell>
                      {quarterlyYears.map(year =>
                        [1, 2, 3, 4].map(q => {
                          const total = getQuarterTotal(year, q);
                          return (
                            <TableCell key={`total-${year}-Q${q}`} className="text-right text-xs">
                              {formatWithUnit(total, displayUnit)}
                            </TableCell>
                          );
                        })
                      )}
                      {annualOnlyYears.map(year => (
                        <TableCell key={`total-${year}-A`} className="text-right text-xs">
                          {formatWithUnit(getTotalRevenue(year), displayUnit)}
                        </TableCell>
                      ))}
                      {editMode && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table data-testid="table-revenue">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Revenue Stream</TableHead>
                    {years.map(year => (
                      <TableHead key={year} className="text-right">{year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLineItems.map((li, liIdx) => (
                    <Fragment key={li.id}>
                      <TableRow data-testid={`row-annual-${li.id}`}>
                        <TableCell className="font-medium">
                          {getLineItemName(li)}
                        </TableCell>
                        {years.map(year => (
                          <TableCell key={year} className="text-right">
                            <div>
                              <span>{formatWithUnit(getAnnualTotal(li.id, year), displayUnit)}</span>
                              {calcStreamPercentOfTotal(li.id, year) !== null && (
                                <div className="text-[10px] text-muted-foreground">
                                  {formatPercent(calcStreamPercentOfTotal(li.id, year)!)} of total
                                </div>
                              )}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow key={`growth-${li.id}`} className="border-b">
                        <TableCell className="text-xs text-muted-foreground pl-6 py-1">YoY Growth</TableCell>
                        {years.map(year => {
                          const g = calcStreamYoYGrowth(li.id, year);
                          return (
                            <TableCell key={year} className="text-right py-1">
                              {renderYoYPct(g)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </Fragment>
                  ))}
                  {newLineItems.filter(ni => ni.name.trim()).map(ni => (
                    <TableRow key={ni.tempId}>
                      <TableCell className="font-medium">{ni.name}</TableCell>
                      {years.map(year => (
                        <TableCell key={year} className="text-right">
                          {formatWithUnit(getNewItemAnnualTotal(ni.tempId, year), displayUnit)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Revenue</TableCell>
                    {years.map(year => (
                      <TableCell key={year} className="text-right" data-testid={`text-total-${year}`}>
                        {formatWithUnit(getTotalRevenue(year), displayUnit)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">YoY Growth</TableCell>
                    {years.map(year => {
                      const growth = calcYoYGrowth(year);
                      return (
                        <TableCell key={year} className="text-right">
                          {renderYoYPct(growth)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual-chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-1">Annual Revenue by Stream <InfoTooltip content="Stacked bar chart showing annual revenue breakdown by stream." /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => formatWithUnit(v, displayUnit)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatWithUnit(v, displayUnit)} />
                    <Legend />
                    {allNames.map((name, i) => (
                      <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual-trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-1">Annual Revenue Trend <InfoTooltip content="Area chart showing annual revenue trends by stream over time." /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={annualChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => formatWithUnit(v, displayUnit)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatWithUnit(v, displayUnit)} />
                    <Legend />
                    {allNames.map((name, i) => (
                      <Area key={name} type="monotone" dataKey={name} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarterly-chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-1">Quarterly Revenue Trend <InfoTooltip content="Area chart showing quarterly revenue trends." /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={quarterlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" angle={-45} textAnchor="end" height={60} />
                    <YAxis className="text-xs" tickFormatter={(v) => formatWithUnit(v, displayUnit)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatWithUnit(v, displayUnit)} />
                    <Legend />
                    {allNames.map((name, i) => (
                      <Area key={name} type="monotone" dataKey={name} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
