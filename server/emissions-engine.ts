const DEFAULT_MONTHS = 60;

export interface AllocationInput {
  category: string;
  standardGroup?: string;
  total_tokens: number;
  tge_percent: number;
  cliff_months: number;
  vesting_months: number;
  vesting_type: "linear" | "cliff" | "immediate";
  percentage?: number;
}

export interface AllocationSchedule {
  category: string;
  standardGroup: string;
  percentage: number;
  totalTokens: number;
  vestingType: string;
  cliffMonths: number;
  vestingMonths: number;
  tgePercent: number;
  monthlyEmissions: number[];
  cumulativeSupply: number[];
}

export interface ProjectEmissions {
  totalMonthlyEmissions: number[];
  totalCumulativeSupply: number[];
  monthlyInflationRate: number[];
  cliffEvents: { monthIndex: number; label: string; amount: number }[];
  allocations: AllocationSchedule[];
}

export interface ProjectAnalytics {
  unlockValuePerMonth: number[];
  totalUnlockValue: number;
  cliffUnlockTokens: number;
  linearUnlockTokens: number;
  cliffUnlockPct: number;
  linearUnlockPct: number;
  totalUnlockPct: number;
  inflationRate: number;
  circulationRatio: number;
  lockedPct: number;
}

export interface ProjectComparisonRow {
  name: string;
  symbol: string;
  coingeckoId: string;
  image: string;
  totalUnlockValue: number;
  cliffUnlockPct: number;
  linearUnlockPct: number;
  totalUnlockPct: number;
  inflationRate: number;
  circulationRatio: number;
  lockedPct: number;
  marketCap: number;
  currentPrice: number;
  totalSupply: number;
  circulatingSupply: number;
}

export interface InflationPeriodRow {
  name: string;
  symbol: string;
  coingeckoId: string;
  image: string;
  year1Inflation: number;
  year2Inflation: number;
  year3Inflation: number;
  currentInflation: number;
}

export interface MarketEmissionsRow {
  monthIndex: number;
  totalValueUnlock: number;
  cliffValueUnlock: number;
  linearValueUnlock: number;
}

export function computeAllocationSchedule(
  alloc: AllocationInput,
  months: number = DEFAULT_MONTHS
): { monthlyEmissions: number[]; cumulativeSupply: number[] } {
  const totalTokens = alloc.total_tokens;
  const tgeTokens = Math.round(totalTokens * (alloc.tge_percent || 0) / 100);
  const remainingTokens = totalTokens - tgeTokens;
  const cliff = Math.max(alloc.cliff_months || 0, 0);
  const vest = Math.max(alloc.vesting_months || 0, 0);
  const vType = alloc.vesting_type || "linear";

  const emissions: number[] = new Array(months).fill(0);

  emissions[0] = tgeTokens;

  if (vType === "immediate" || (vest === 0 && cliff === 0)) {
    emissions[0] = totalTokens;
  } else if (vType === "cliff") {
    const unlockMonth = Math.min(cliff, months - 1);
    if (unlockMonth > 0) {
      emissions[unlockMonth] = remainingTokens;
    } else {
      emissions[0] = totalTokens;
    }
  } else {
    if (vest > 0) {
      const perMonth = remainingTokens / vest;
      for (let m = cliff; m < Math.min(cliff + vest, months); m++) {
        if (m === 0) {
          emissions[0] += perMonth;
        } else {
          emissions[m] = perMonth;
        }
      }
    } else if (cliff > 0) {
      const unlockMonth = Math.min(cliff, months - 1);
      emissions[unlockMonth] += remainingTokens;
    }
  }

  const cumulative = deltaToCumulative(emissions);

  return { monthlyEmissions: emissions.map(Math.round), cumulativeSupply: cumulative.map(Math.round) };
}

export function deltaToCumulative(deltas: number[]): number[] {
  const cumulative: number[] = new Array(deltas.length);
  let running = 0;
  for (let i = 0; i < deltas.length; i++) {
    running += deltas[i];
    cumulative[i] = running;
  }
  return cumulative;
}

export function cumulativeToDeltas(cumulative: number[]): number[] {
  const deltas: number[] = new Array(cumulative.length);
  for (let i = 0; i < cumulative.length; i++) {
    deltas[i] = i === 0 ? cumulative[0] : Math.max(cumulative[i] - cumulative[i - 1], 0);
  }
  return deltas;
}

export function aggregateProjectEmissions(
  allocations: AllocationInput[],
  months: number = DEFAULT_MONTHS
): ProjectEmissions {
  const schedules: AllocationSchedule[] = allocations.map((a) => {
    const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(a, months);
    return {
      category: a.category,
      standardGroup: a.standardGroup || "community",
      percentage: a.percentage || 0,
      totalTokens: a.total_tokens,
      vestingType: a.vesting_type || "linear",
      cliffMonths: a.cliff_months || 0,
      vestingMonths: a.vesting_months || 0,
      tgePercent: a.tge_percent || 0,
      monthlyEmissions,
      cumulativeSupply,
    };
  });

  const totalMonthlyEmissions: number[] = new Array(months).fill(0);
  for (const s of schedules) {
    for (let m = 0; m < months; m++) {
      totalMonthlyEmissions[m] += s.monthlyEmissions[m];
    }
  }

  const totalCumulativeSupply = deltaToCumulative(totalMonthlyEmissions);

  const monthlyInflationRate: number[] = new Array(months).fill(0);
  for (let m = 1; m < months; m++) {
    if (totalCumulativeSupply[m - 1] > 0) {
      monthlyInflationRate[m] = (totalMonthlyEmissions[m] / totalCumulativeSupply[m - 1]) * 100;
    }
  }

  const cliffEvents: { monthIndex: number; label: string; amount: number }[] = [];
  for (const s of schedules) {
    if (s.vestingType === "cliff" && s.cliffMonths > 0 && s.cliffMonths < months) {
      const amount = s.monthlyEmissions[s.cliffMonths];
      if (amount > 0) {
        cliffEvents.push({
          monthIndex: s.cliffMonths,
          label: `${s.category} Cliff Unlock`,
          amount,
        });
      }
    }
  }

  return {
    totalMonthlyEmissions: totalMonthlyEmissions.map(Math.round),
    totalCumulativeSupply: totalCumulativeSupply.map(Math.round),
    monthlyInflationRate,
    cliffEvents,
    allocations: schedules,
  };
}

export function computeAnalytics(
  allocations: AllocationInput[],
  currentPrice: number,
  circulatingSupply: number,
  totalSupply: number,
  months: number = DEFAULT_MONTHS
): ProjectAnalytics {
  const project = aggregateProjectEmissions(allocations, months);

  const unlockValuePerMonth = project.totalMonthlyEmissions.map(
    (tokens) => tokens * currentPrice
  );
  const totalUnlockValue = unlockValuePerMonth.reduce((sum, v) => sum + v, 0);

  let cliffUnlockTokens = 0;
  let linearUnlockTokens = 0;

  for (const a of project.allocations) {
    const tgeTokens = Math.round(a.totalTokens * (a.tgePercent || 0) / 100);
    const remaining = a.totalTokens - tgeTokens;
    if (a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear")) {
      cliffUnlockTokens += remaining;
    } else if (a.vestingType === "linear" || a.vestingMonths > 0) {
      linearUnlockTokens += remaining;
    }
  }

  const safeTotalSupply = totalSupply || 1;
  const cliffUnlockPct = (cliffUnlockTokens / safeTotalSupply) * 100;
  const linearUnlockPct = (linearUnlockTokens / safeTotalSupply) * 100;
  const totalUnlockPct = cliffUnlockPct + linearUnlockPct;

  const locked = totalSupply - circulatingSupply;
  const inflationRate = circulatingSupply > 0 ? (locked / circulatingSupply) * 100 : 0;
  const circulationRatio = totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 0;
  const lockedPct = 100 - circulationRatio;

  return {
    unlockValuePerMonth,
    totalUnlockValue,
    cliffUnlockTokens,
    linearUnlockTokens,
    cliffUnlockPct,
    linearUnlockPct,
    totalUnlockPct,
    inflationRate,
    circulationRatio,
    lockedPct,
  };
}

export function compareProjects(
  projects: {
    name: string;
    symbol: string;
    coingeckoId: string;
    image: string;
    allocations: AllocationInput[];
    currentPrice: number;
    circulatingSupply: number;
    totalSupply: number;
    marketCap: number;
  }[]
): ProjectComparisonRow[] {
  return projects.map((p) => {
    const analytics = computeAnalytics(
      p.allocations,
      p.currentPrice,
      p.circulatingSupply,
      p.totalSupply
    );
    return {
      name: p.name,
      symbol: p.symbol,
      coingeckoId: p.coingeckoId,
      image: p.image,
      totalUnlockValue: analytics.totalUnlockValue,
      cliffUnlockPct: analytics.cliffUnlockPct,
      linearUnlockPct: analytics.linearUnlockPct,
      totalUnlockPct: analytics.totalUnlockPct,
      inflationRate: analytics.inflationRate,
      circulationRatio: analytics.circulationRatio,
      lockedPct: analytics.lockedPct,
      marketCap: p.marketCap,
      currentPrice: p.currentPrice,
      totalSupply: p.totalSupply,
      circulatingSupply: p.circulatingSupply,
    };
  });
}

export function computeInflationPeriods(
  projects: {
    name: string;
    symbol: string;
    coingeckoId: string;
    image: string;
    monthlyInflationRate: number[];
  }[]
): InflationPeriodRow[] {
  const annualize = (monthlyAvg: number) =>
    ((1 + monthlyAvg / 100) ** 12 - 1) * 100;
  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  return projects.map((p) => {
    const rates = p.monthlyInflationRate;
    return {
      name: p.name,
      symbol: p.symbol,
      coingeckoId: p.coingeckoId,
      image: p.image,
      year1Inflation: annualize(avg(rates.slice(0, 12))),
      year2Inflation: annualize(avg(rates.slice(12, 24))),
      year3Inflation: annualize(avg(rates.slice(24, 36))),
      currentInflation: rates.length > 0 ? annualize(rates[rates.length - 1]) : 0,
    };
  });
}

export function computeMarketEmissions(
  projects: {
    allocations: AllocationSchedule[];
    currentPrice: number;
  }[],
  months: number = DEFAULT_MONTHS
): MarketEmissionsRow[] {
  const rows: MarketEmissionsRow[] = [];

  for (let i = 0; i < months; i++) {
    let totalVal = 0;
    let cliffVal = 0;
    let linearVal = 0;

    for (const p of projects) {
      const price = p.currentPrice || 0;
      for (const a of p.allocations) {
        if (i >= a.monthlyEmissions.length) continue;
        const val = a.monthlyEmissions[i] * price;
        totalVal += val;

        const isCliff = a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear");
        if (isCliff) {
          cliffVal += val;
        } else {
          linearVal += val;
        }
      }
    }

    rows.push({
      monthIndex: i,
      totalValueUnlock: totalVal,
      cliffValueUnlock: cliffVal,
      linearValueUnlock: linearVal,
    });
  }

  return rows;
}

export function toAllocationInput(raw: {
  category?: string;
  standardGroup?: string;
  percentage?: number;
  totalTokens?: number;
  total_tokens?: number;
  vestingType?: string;
  vesting_type?: string;
  cliffMonths?: number;
  cliff_months?: number;
  vestingMonths?: number;
  vesting_months?: number;
  tgePercent?: number;
  tge_percent?: number;
}, totalSupply?: number): AllocationInput {
  const pct = raw.percentage || 0;
  const tokens = raw.totalTokens || raw.total_tokens || (totalSupply ? Math.round(totalSupply * pct / 100) : 0);

  return {
    category: raw.category || "Unknown",
    standardGroup: raw.standardGroup,
    total_tokens: tokens,
    tge_percent: raw.tgePercent ?? raw.tge_percent ?? 0,
    cliff_months: raw.cliffMonths ?? raw.cliff_months ?? 0,
    vesting_months: raw.vestingMonths ?? raw.vesting_months ?? 0,
    vesting_type: (raw.vestingType || raw.vesting_type || "linear") as AllocationInput["vesting_type"],
    percentage: pct,
  };
}
