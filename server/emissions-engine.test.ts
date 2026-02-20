import {
  computeAllocationSchedule,
  aggregateProjectEmissions,
  computeAnalytics,
  compareProjects,
  computeInflationPeriods,
  computeMarketEmissions,
  deltaToCumulative,
  cumulativeToDeltas,
  toAllocationInput,
  type AllocationInput,
} from "./emissions-engine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
  }
}

function approxEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));
}

console.log("\n=== Emissions Engine Test Suite ===\n");

console.log("--- Test 1: Linear Vesting Schedule ---");
{
  const alloc: AllocationInput = {
    category: "Team",
    total_tokens: 12000,
    tge_percent: 0,
    cliff_months: 6,
    vesting_months: 12,
    vesting_type: "linear",
  };
  const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(alloc, 24);

  assert(monthlyEmissions[0] === 0, "Month 0: no TGE tokens (tge_percent=0)");
  assert(monthlyEmissions[1] === 0, "Month 1: still in cliff (no unlock)");
  assert(monthlyEmissions[5] === 0, "Month 5: still in cliff (no unlock)");
  assert(monthlyEmissions[6] === 1000, "Month 6: first linear unlock = 12000/12 = 1000");
  assert(monthlyEmissions[17] === 1000, "Month 17: last linear unlock = 1000");
  assert(monthlyEmissions[18] === 0, "Month 18: vesting complete, no more tokens");
  assert(cumulativeSupply[5] === 0, "Cumulative at month 5: 0 (still in cliff)");
  assert(cumulativeSupply[6] === 1000, "Cumulative at month 6: 1000");
  assert(cumulativeSupply[17] === 12000, "Cumulative at month 17: all 12000 vested");
  assert(cumulativeSupply[23] === 12000, "Cumulative at month 23: stays at 12000");
}

console.log("\n--- Test 2: Cliff Vesting Schedule ---");
{
  const alloc: AllocationInput = {
    category: "Investors",
    total_tokens: 10000,
    tge_percent: 10,
    cliff_months: 12,
    vesting_months: 0,
    vesting_type: "cliff",
  };
  const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(alloc, 24);

  assert(monthlyEmissions[0] === 1000, "Month 0: TGE = 10% of 10000 = 1000");
  assert(monthlyEmissions[1] === 0, "Month 1: waiting for cliff");
  assert(monthlyEmissions[11] === 0, "Month 11: still waiting for cliff");
  assert(monthlyEmissions[12] === 9000, "Month 12: cliff unlock = remaining 9000");
  assert(monthlyEmissions[13] === 0, "Month 13: nothing left to unlock");
  assert(cumulativeSupply[0] === 1000, "Cumulative at month 0: 1000 (TGE)");
  assert(cumulativeSupply[11] === 1000, "Cumulative at month 11: still 1000");
  assert(cumulativeSupply[12] === 10000, "Cumulative at month 12: all 10000");
}

console.log("\n--- Test 3: Immediate Vesting ---");
{
  const alloc: AllocationInput = {
    category: "Airdrop",
    total_tokens: 5000,
    tge_percent: 0,
    cliff_months: 0,
    vesting_months: 0,
    vesting_type: "immediate",
  };
  const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(alloc, 12);

  assert(monthlyEmissions[0] === 5000, "Month 0: all tokens unlocked immediately");
  assert(monthlyEmissions[1] === 0, "Month 1: nothing left");
  assert(cumulativeSupply[0] === 5000, "Cumulative at month 0: 5000");
  assert(cumulativeSupply[11] === 5000, "Cumulative at month 11: stays at 5000");
}

console.log("\n--- Test 4: TGE + Linear (No Cliff) ---");
{
  const alloc: AllocationInput = {
    category: "Community",
    total_tokens: 10000,
    tge_percent: 20,
    cliff_months: 0,
    vesting_months: 4,
    vesting_type: "linear",
  };
  const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(alloc, 10);

  assert(monthlyEmissions[0] === 4000, "Month 0: TGE 2000 + first linear 2000 = 4000");
  assert(monthlyEmissions[1] === 2000, "Month 1: linear 8000/4 = 2000");
  assert(monthlyEmissions[3] === 2000, "Month 3: last linear unlock = 2000");
  assert(monthlyEmissions[4] === 0, "Month 4: vesting complete");
  assert(cumulativeSupply[3] === 10000, "Cumulative at month 3: all 10000 vested");
}

console.log("\n--- Test 5: Project Aggregation (Multiple Allocations) ---");
{
  const allocations: AllocationInput[] = [
    {
      category: "Team",
      total_tokens: 6000,
      tge_percent: 0,
      cliff_months: 6,
      vesting_months: 6,
      vesting_type: "linear",
    },
    {
      category: "Investors",
      total_tokens: 4000,
      tge_percent: 25,
      cliff_months: 3,
      vesting_months: 0,
      vesting_type: "cliff",
    },
  ];

  const project = aggregateProjectEmissions(allocations, 12);

  assert(project.totalMonthlyEmissions[0] === 1000, "Month 0: only investor TGE (25% of 4000) = 1000");
  assert(project.totalMonthlyEmissions[3] === 3000, "Month 3: investor cliff unlock = 3000");
  assert(project.totalMonthlyEmissions[6] === 1000, "Month 6: team starts linear = 6000/6 = 1000");

  const totalTokens = project.totalCumulativeSupply[11];
  assert(totalTokens === 10000, "Cumulative at month 11: all 10000 tokens");

  assert(project.cliffEvents.length >= 1, "At least 1 cliff event detected");
  assert(project.cliffEvents[0].monthIndex === 3, "Cliff event at month 3");
  assert(project.cliffEvents[0].amount === 3000, "Cliff event: 3000 tokens");
}

console.log("\n--- Test 6: Analytics Computation ---");
{
  const allocations: AllocationInput[] = [
    {
      category: "All",
      total_tokens: 100000,
      tge_percent: 10,
      cliff_months: 0,
      vesting_months: 12,
      vesting_type: "linear",
    },
  ];

  const analytics = computeAnalytics(allocations, 2.5, 50000, 100000, 12);

  assert(analytics.circulationRatio === 50, "Circulation ratio: 50%");
  assert(analytics.lockedPct === 50, "Locked: 50%");
  assert(analytics.inflationRate === 100, "Inflation rate: (50k locked / 50k circ) * 100 = 100%");

  assert(analytics.totalUnlockValue > 0, "Total unlock value is positive");
  assert(analytics.unlockValuePerMonth.length === 12, "12 months of unlock values");
  assert(analytics.unlockValuePerMonth[0] > 0, "Month 0 unlock value is positive (TGE)");
}

console.log("\n--- Test 7: Compare Projects ---");
{
  const rows = compareProjects([
    {
      name: "Token A",
      symbol: "TOKA",
      coingeckoId: "token-a",
      image: "",
      allocations: [{
        category: "All",
        total_tokens: 100000,
        tge_percent: 50,
        cliff_months: 0,
        vesting_months: 12,
        vesting_type: "linear",
      }],
      currentPrice: 1.0,
      circulatingSupply: 50000,
      totalSupply: 100000,
      marketCap: 50000,
    },
    {
      name: "Token B",
      symbol: "TOKB",
      coingeckoId: "token-b",
      image: "",
      allocations: [{
        category: "All",
        total_tokens: 200000,
        tge_percent: 0,
        cliff_months: 12,
        vesting_months: 0,
        vesting_type: "cliff",
      }],
      currentPrice: 0.5,
      circulatingSupply: 10000,
      totalSupply: 200000,
      marketCap: 5000,
    },
  ]);

  assert(rows.length === 2, "Two comparison rows");
  assert(rows[0].name === "Token A", "First project: Token A");
  assert(rows[1].name === "Token B", "Second project: Token B");
  assert(rows[1].inflationRate > rows[0].inflationRate, "Token B has higher inflation (more locked relative to circulating)");
  assert(rows[1].lockedPct > rows[0].lockedPct, "Token B has higher locked percentage");
}

console.log("\n--- Test 8: Inflation Periods ---");
{
  const monthlyRates = new Array(60).fill(0).map((_, i) => {
    if (i < 12) return 2.0;
    if (i < 24) return 1.0;
    if (i < 36) return 0.5;
    return 0.1;
  });

  const periods = computeInflationPeriods([{
    name: "Test Token",
    symbol: "TEST",
    coingeckoId: "test",
    image: "",
    monthlyInflationRate: monthlyRates,
  }]);

  assert(periods.length === 1, "One inflation period row");
  assert(periods[0].year1Inflation > periods[0].year2Inflation, "Year 1 inflation > Year 2");
  assert(periods[0].year2Inflation > periods[0].year3Inflation, "Year 2 inflation > Year 3");
}

console.log("\n--- Test 9: Delta/Cumulative Conversion ---");
{
  const deltas = [100, 50, 50, 0, 200];
  const cum = deltaToCumulative(deltas);
  assert(cum[0] === 100, "Cumulative[0] = 100");
  assert(cum[1] === 150, "Cumulative[1] = 150");
  assert(cum[4] === 400, "Cumulative[4] = 400");

  const back = cumulativeToDeltas(cum);
  assert(back[0] === 100, "Delta[0] = 100");
  assert(back[1] === 50, "Delta[1] = 50");
  assert(back[4] === 200, "Delta[4] = 200");
}

console.log("\n--- Test 10: toAllocationInput Adapter ---");
{
  const raw = {
    category: "Team",
    percentage: 15,
    cliffMonths: 12,
    vestingMonths: 24,
    tgePercent: 5,
    vestingType: "linear",
  };
  const input = toAllocationInput(raw, 1000000);
  assert(input.total_tokens === 150000, "15% of 1M = 150000 tokens");
  assert(input.cliff_months === 12, "Cliff months preserved");
  assert(input.vesting_months === 24, "Vesting months preserved");
  assert(input.tge_percent === 5, "TGE percent preserved");
  assert(input.vesting_type === "linear", "Vesting type preserved");
}

console.log("\n--- Test 11: Market Emissions Aggregation ---");
{
  const alloc1: AllocationInput = {
    category: "Team",
    total_tokens: 12000,
    tge_percent: 0,
    cliff_months: 0,
    vesting_months: 12,
    vesting_type: "linear",
  };
  const project1 = aggregateProjectEmissions([alloc1], 12);

  const rows = computeMarketEmissions([{
    allocations: project1.allocations,
    currentPrice: 10,
  }], 12);

  assert(rows.length === 12, "12 months of market emissions");
  assert(rows[0].totalValueUnlock === 10000, "Month 0: 1000 tokens * $10 = $10000");
  assert(rows[1].totalValueUnlock === 10000, "Month 1: 1000 tokens * $10 = $10000");
}

console.log("\n--- Test 12: Edge Case — Zero Tokens ---");
{
  const alloc: AllocationInput = {
    category: "Empty",
    total_tokens: 0,
    tge_percent: 50,
    cliff_months: 6,
    vesting_months: 12,
    vesting_type: "linear",
  };
  const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(alloc, 12);
  assert(monthlyEmissions.every(v => v === 0), "All emissions are 0 for 0-token allocation");
  assert(cumulativeSupply.every(v => v === 0), "All cumulative are 0 for 0-token allocation");
}

console.log("\n--- Test 13: Edge Case — Cliff Beyond Window ---");
{
  const alloc: AllocationInput = {
    category: "Future",
    total_tokens: 10000,
    tge_percent: 0,
    cliff_months: 100,
    vesting_months: 12,
    vesting_type: "linear",
  };
  const { monthlyEmissions, cumulativeSupply } = computeAllocationSchedule(alloc, 60);
  assert(monthlyEmissions.every(v => v === 0), "No emissions within 60-month window (cliff at 100)");
  assert(cumulativeSupply[59] === 0, "Cumulative stays 0");
}

console.log("\n=== All tests complete ===\n");
