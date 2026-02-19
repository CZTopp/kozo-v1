import OpenAI from "openai";
import { storage } from "./storage";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

export interface CopilotContextParams {
  modelId?: string;
  cryptoProjectId?: string;
  contextType?: string;
}

export async function gatherModelContext(modelId: string, userId: string) {
  const model = await storage.getModel(modelId, userId);
  if (!model) return null;

  const [revenuePeriods, lineItems, isLines, bsLines, cfLines, dcf, valComp] = await Promise.all([
    storage.getRevenuePeriods(modelId),
    storage.getRevenueLineItems(modelId),
    storage.getIncomeStatementLines(modelId),
    storage.getBalanceSheetLines(modelId),
    storage.getCashFlowLines(modelId),
    storage.getDcfValuation(modelId),
    storage.getValuationComparison(modelId),
  ]);

  const annualRevenue = revenuePeriods
    .filter(p => !p.quarter)
    .sort((a, b) => a.year - b.year)
    .map(p => ({ year: p.year, amount: p.amount }));

  const annualIS = isLines
    .filter(r => !r.quarter)
    .sort((a, b) => a.year - b.year)
    .map(r => ({
      year: r.year,
      revenue: r.revenue,
      cogs: r.cogs,
      grossProfit: r.grossProfit,
      operatingIncome: r.operatingIncome,
      netIncome: r.netIncome,
      grossMargin: r.grossProfit && r.revenue ? r.grossProfit / r.revenue : null,
      operatingMargin: r.operatingIncome && r.revenue ? r.operatingIncome / r.revenue : null,
      netMargin: r.netIncome && r.revenue ? r.netIncome / r.revenue : null,
    }));

  const annualBS = bsLines
    .filter(r => !r.quarter)
    .sort((a, b) => a.year - b.year)
    .map(r => ({
      year: r.year,
      totalAssets: r.totalAssets,
      totalLiabilities: r.totalLiabilities,
      totalEquity: r.totalEquity,
      cash: r.cash,
      totalDebt: (r.shortTermDebt || 0) + (r.longTermDebt || 0),
    }));

  const annualCF = cfLines
    .filter(r => !r.quarter)
    .sort((a, b) => a.year - b.year)
    .map(r => ({
      year: r.year,
      operatingCashFlow: r.operatingCashFlow,
      capex: r.capex,
      freeCashFlow: r.freeCashFlow,
    }));

  const dcfSummary = dcf ? {
    currentSharePrice: dcf.currentSharePrice,
    targetPricePerShare: dcf.targetPricePerShare,
    riskFreeRate: dcf.riskFreeRate,
    beta: dcf.beta,
    marketReturn: dcf.marketReturn,
    costOfDebt: dcf.costOfDebt,
    equityWeight: dcf.equityWeight,
    debtWeight: dcf.debtWeight,
    taxRate: dcf.taxRate,
    longTermGrowth: dcf.longTermGrowth,
    totalDebt: dcf.totalDebt,
    sharesOutstanding: dcf.sharesOutstanding,
  } : null;

  const valSummary = valComp ? {
    currentSharePrice: valComp.currentSharePrice,
    averageTarget: valComp.averageTarget,
    percentToTarget: valComp.percentToTarget,
    dcfBaseTarget: valComp.dcfBaseTarget,
    dcfBullTarget: valComp.dcfBullTarget,
    dcfBearTarget: valComp.dcfBearTarget,
    prBaseTarget: valComp.prBaseTarget,
    peBaseTarget: valComp.peBaseTarget,
  } : null;

  return {
    company: {
      name: model.name,
      ticker: model.ticker,
      currency: model.currency,
      sharesOutstanding: model.sharesOutstanding,
      startYear: model.startYear,
      endYear: model.endYear,
      modelMode: model.modelMode,
    },
    revenueStreams: lineItems.map(li => ({ name: li.name })),
    annualRevenue,
    incomeStatement: annualIS,
    balanceSheet: annualBS,
    cashFlow: annualCF,
    dcf: dcfSummary,
    valuation: valSummary,
  };
}

async function gatherCryptoProjectContext(projectId: string, userId: string) {
  const project = await storage.getCryptoProject(projectId, userId);
  if (!project) return null;

  const [schedules, incentives, allocations, fundraising, metrics, forecasts, flows] = await Promise.all([
    storage.getTokenSupplySchedules(projectId),
    storage.getTokenIncentives(projectId),
    storage.getTokenAllocations(projectId),
    storage.getFundraisingRounds(projectId),
    storage.getProtocolMetrics(projectId),
    storage.getRevenueForecasts(projectId),
    storage.getTokenFlowEntries(projectId),
  ]);

  return {
    project: {
      name: project.name,
      symbol: project.symbol,
      category: project.category,
      currentPrice: project.currentPrice,
      marketCap: project.marketCap,
      fullyDilutedValuation: project.fullyDilutedValuation,
      volume24h: project.volume24h,
      circulatingSupply: project.circulatingSupply,
      totalSupply: project.totalSupply,
      maxSupply: project.maxSupply,
      ath: project.ath,
      athDate: project.athDate,
      priceChange24h: project.priceChange24h,
      priceChange7d: project.priceChange7d,
    },
    tokenAllocations: allocations.map(a => ({
      category: a.category,
      percentage: a.percentage,
      vestingMonths: a.vestingMonths,
      cliffMonths: a.cliffMonths,
      tgePercent: a.tgePercent,
    })),
    fundraisingRounds: fundraising.map(r => ({
      roundType: r.roundType,
      amount: r.amount,
      valuation: r.valuation,
      date: r.date,
      leadInvestors: r.leadInvestors,
      tokenPrice: r.tokenPrice,
    })),
    supplySchedules: schedules.slice(0, 20).map(s => ({
      eventType: s.eventType,
      label: s.label,
      date: s.date,
      amount: s.amount,
    })),
    incentives: incentives.slice(0, 10).map(i => ({
      role: i.role,
      rewardType: i.rewardType,
      allocationPercent: i.allocationPercent,
      isSustainable: i.isSustainable,
    })),
    recentMetrics: metrics.slice(-5).map(m => ({
      date: m.date,
      tvl: m.tvl,
      dailyFees: m.dailyFees,
      dailyRevenue: m.dailyRevenue,
    })),
    revenueForecasts: forecasts.slice(0, 15).map(f => ({
      year: f.year,
      scenario: f.scenario,
      projectedFees: f.projectedFees,
      projectedRevenue: f.projectedRevenue,
      netValueAccrual: f.netValueAccrual,
    })),
    tokenFlows: flows.slice(0, 12).map(f => ({
      periodLabel: f.periodLabel,
      minting: f.minting,
      unlocks: f.unlocks,
      burns: f.burns,
      netFlow: f.netFlow,
      cumulativeSupply: f.cumulativeSupply,
    })),
  };
}

async function gatherCryptoDashboardContext(userId: string) {
  const projects = await storage.getCryptoProjects(userId);
  if (!projects || projects.length === 0) return null;

  return {
    trackedProjects: projects.map(p => ({
      name: p.name,
      symbol: p.symbol,
      currentPrice: p.currentPrice,
      marketCap: p.marketCap,
      fullyDilutedValuation: p.fullyDilutedValuation,
      priceChange24h: p.priceChange24h,
      priceChange7d: p.priceChange7d,
      circulatingSupply: p.circulatingSupply,
      totalSupply: p.totalSupply,
      category: p.category,
    })),
    totalTracked: projects.length,
    totalMarketCap: projects.reduce((s, p) => s + (p.marketCap || 0), 0),
  };
}

const FINANCIAL_SYSTEM_PROMPT = `You are Foresight Copilot, an expert Wall Street financial analyst assistant embedded in a financial modeling platform. You have deep knowledge of:
- Financial statement analysis (Income Statement, Balance Sheet, Cash Flow)
- DCF valuation and WACC calculations
- Revenue forecasting and growth analysis
- Valuation methodologies (P/E, P/R, PEG, DCF)
- Financial ratios and metrics
- Market analysis and investment thesis development

Your role is to:
1. Answer questions about the user's financial models with specific numbers and insights
2. Generate written analysis summaries highlighting key trends, strengths, and concerns
3. Suggest parameter adjustments with clear reasoning (e.g., "Your beta of 0.8 seems low for a tech company; consider 1.2-1.5")
4. Explain financial terms in context of the user's actual data
5. Identify potential issues or red flags in the model

Guidelines:
- Always reference specific numbers from the model data when available
- Be concise but thorough - use bullet points and structured formatting
- When suggesting changes, explain the impact on valuation
- Use markdown formatting for readability (headers, bold, lists, tables)
- If data is missing or incomplete, point that out and suggest what to add
- Maintain a professional, analytical tone`;

const CRYPTO_SYSTEM_PROMPT = `You are Foresight Copilot, an expert crypto and DeFi analyst assistant embedded in a crypto analysis platform. You have deep knowledge of:
- Token economics and supply dynamics (vesting, unlocks, emissions, burns)
- DeFi protocol analysis (TVL, fees, revenue, sustainability)
- Token valuation methodologies (DCF on protocol revenue, comparable analysis, network value models)
- Fundraising analysis (seed, private, public rounds, valuation benchmarks)
- Token allocation analysis (team, investor, community, treasury distributions)
- On-chain metrics and supply concentration
- Market microstructure and liquidity analysis

Your role is to:
1. Analyze token economics, supply schedules, and unlock impacts on price
2. Evaluate protocol revenue sustainability and growth trajectories
3. Assess token allocation fairness and vesting schedule implications
4. Compare fundraising terms and valuations against market benchmarks
5. Identify risks including emission dilution, concentration, and sustainability concerns
6. Provide actionable insights for the specific project being analyzed

Guidelines:
- Always reference specific data from the project when available
- Be honest about speculative tokens - note when fundamentals don't support valuation
- Quantify dilution impacts from upcoming unlocks
- Use markdown formatting for readability
- Maintain a professional, analytical tone`;

const CRYPTO_DASHBOARD_SYSTEM_PROMPT = `You are Foresight Copilot, an expert crypto and DeFi analyst. The user is viewing their crypto watchlist dashboard. You can help with:
- General crypto market questions and analysis
- Comparing projects in their watchlist
- Token economics concepts (vesting, emissions, burns, staking)
- DeFi protocol mechanics and revenue models
- Valuation frameworks for crypto assets
- Market trends and narrative analysis

Guidelines:
- You have context about the user's tracked projects (names, prices, market caps, supply data)
- You can compare and contrast projects in their watchlist
- Be concise and use markdown formatting
- If asked about a specific project in detail, suggest they navigate to that project's analysis pages for deeper data`;

export async function streamCopilotToResponse(
  params: CopilotContextParams,
  userId: string,
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  res: import("express").Response,
  isDisconnected: () => boolean
): Promise<void> {
  let systemPrompt: string;
  let contextMessage: string;

  if (params.cryptoProjectId) {
    const context = await gatherCryptoProjectContext(params.cryptoProjectId, userId);
    if (!context) {
      res.write(`data: ${JSON.stringify({ content: "I couldn't find the crypto project. Please try navigating to a project first." })}\n\n`);
      return;
    }
    systemPrompt = CRYPTO_SYSTEM_PROMPT;
    contextMessage = `Here is the current data for ${context.project.name} (${context.project.symbol}):\n\n${JSON.stringify(context, null, 2)}`;
  } else if (params.contextType === "crypto-dashboard") {
    const context = await gatherCryptoDashboardContext(userId);
    systemPrompt = CRYPTO_DASHBOARD_SYSTEM_PROMPT;
    contextMessage = context
      ? `The user is tracking ${context.totalTracked} crypto projects with a combined market cap of $${(context.totalMarketCap / 1e9).toFixed(2)}B:\n\n${JSON.stringify(context, null, 2)}`
      : "The user has no crypto projects tracked yet.";
  } else if (params.modelId) {
    const context = await gatherModelContext(params.modelId, userId);
    if (!context) {
      res.write(`data: ${JSON.stringify({ content: "I couldn't find the financial model. Please select a company from the sidebar first." })}\n\n`);
      return;
    }
    systemPrompt = FINANCIAL_SYSTEM_PROMPT;
    contextMessage = `Here is the current financial model data for ${context.company.name} (${context.company.ticker || "no ticker"}):\n\n${JSON.stringify(context, null, 2)}`;
  } else {
    systemPrompt = CRYPTO_DASHBOARD_SYSTEM_PROMPT;
    contextMessage = "The user is asking a general question. Answer based on your knowledge of financial markets, crypto, and DeFi.";
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextMessage },
    ...conversationHistory.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const openai = getOpenAIClient();

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2000,
  });

  for await (const chunk of stream) {
    if (isDisconnected()) {
      stream.controller.abort();
      break;
    }
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }
}
