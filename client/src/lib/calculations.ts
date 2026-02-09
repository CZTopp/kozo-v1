import type { Assumptions, ForecastRow, Actual, VarianceRow } from "@shared/schema";

export function generateForecast(assumptions: Assumptions, startYear: number, endYear: number): ForecastRow[] {
  const rows: ForecastRow[] = [];
  let cashBalance = Number(assumptions.initialCash || 100000);
  let customers = assumptions.initialCustomers || 100;
  const growthRate = Number(assumptions.revenueGrowthRate || 0.10);
  const churnRate = Number(assumptions.churnRate || 0.05);
  const arpu = Number(assumptions.avgRevenuePerUnit || 100);
  const cogsP = Number(assumptions.cogsPercent || 0.30);
  const smP = Number(assumptions.salesMarketingPercent || 0.20);
  const rdP = Number(assumptions.rdPercent || 0.15);
  const gaP = Number(assumptions.gaPercent || 0.10);
  const taxR = Number(assumptions.taxRate || 0.25);

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const monthIndex = (year - startYear) * 12 + (month - 1);
      if (monthIndex > 0) {
        const monthlyGrowth = Math.pow(1 + growthRate, 1 / 12) - 1;
        const monthlyChurn = churnRate / 12;
        customers = Math.round(customers * (1 + monthlyGrowth - monthlyChurn));
      }

      const revenue = customers * arpu / 12;
      const cogs = revenue * cogsP;
      const grossProfit = revenue - cogs;
      const salesMarketing = revenue * smP;
      const rd = revenue * rdP;
      const ga = revenue * gaP;
      const totalOpex = salesMarketing + rd + ga;
      const ebitda = grossProfit - totalOpex;
      const taxableIncome = ebitda;
      const taxes = taxableIncome > 0 ? taxableIncome * taxR : 0;
      const netIncome = taxableIncome - taxes;
      const cashFlow = netIncome;
      cashBalance += cashFlow;

      const monthlyBurn = cashFlow < 0 ? Math.abs(cashFlow) : 0;
      const runway = monthlyBurn > 0 ? cashBalance / monthlyBurn : null;

      const period = `${year}-${String(month).padStart(2, "0")}`;

      rows.push({
        period,
        year,
        month,
        revenue: Math.round(revenue),
        cogs: Math.round(cogs),
        grossProfit: Math.round(grossProfit),
        salesMarketing: Math.round(salesMarketing),
        rd: Math.round(rd),
        ga: Math.round(ga),
        totalOpex: Math.round(totalOpex),
        ebitda: Math.round(ebitda),
        netIncome: Math.round(netIncome),
        cashFlow: Math.round(cashFlow),
        cashBalance: Math.round(cashBalance),
        customers,
        runway: runway !== null ? Math.round(runway * 10) / 10 : null,
      });
    }
  }
  return rows;
}

export function generateAnnualSummary(rows: ForecastRow[]) {
  const yearMap = new Map<number, ForecastRow[]>();
  rows.forEach((r) => {
    if (!yearMap.has(r.year)) yearMap.set(r.year, []);
    yearMap.get(r.year)!.push(r);
  });

  return Array.from(yearMap.entries()).map(([year, months]) => ({
    year,
    revenue: months.reduce((s, m) => s + m.revenue, 0),
    cogs: months.reduce((s, m) => s + m.cogs, 0),
    grossProfit: months.reduce((s, m) => s + m.grossProfit, 0),
    totalOpex: months.reduce((s, m) => s + m.totalOpex, 0),
    ebitda: months.reduce((s, m) => s + m.ebitda, 0),
    netIncome: months.reduce((s, m) => s + m.netIncome, 0),
    cashFlow: months.reduce((s, m) => s + m.cashFlow, 0),
    cashBalance: months[months.length - 1].cashBalance,
    customers: months[months.length - 1].customers,
    runway: months[months.length - 1].runway,
  }));
}

export function calculateVariance(
  forecast: ForecastRow[],
  actualsData: Actual[]
): VarianceRow[] {
  const actualsMap = new Map<string, Actual>();
  actualsData.forEach((a) => actualsMap.set(a.period, a));

  return forecast.map((f) => {
    const actual = actualsMap.get(f.period);
    const actualRev = actual?.revenue ? Number(actual.revenue) : null;
    const actualNI = actual?.netIncome ? Number(actual.netIncome) : null;
    const actualCash = actual?.cashBalance ? Number(actual.cashBalance) : null;

    return {
      period: f.period,
      forecastRevenue: f.revenue,
      actualRevenue: actualRev,
      revenueVariance: actualRev !== null ? actualRev - f.revenue : null,
      revenueVariancePercent: actualRev !== null && f.revenue !== 0 ? ((actualRev - f.revenue) / f.revenue) * 100 : null,
      forecastNetIncome: f.netIncome,
      actualNetIncome: actualNI,
      netIncomeVariance: actualNI !== null ? actualNI - f.netIncome : null,
      forecastCash: f.cashBalance,
      actualCash: actualCash,
      cashVariance: actualCash !== null ? actualCash - f.cashBalance : null,
    };
  });
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
