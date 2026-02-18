import OpenAI from "openai";
import { storage } from "./storage";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

export async function gatherModelContext(modelId: string) {
  const model = await storage.getModel(modelId);
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

const SYSTEM_PROMPT = `You are Foresight Copilot, an expert Wall Street financial analyst assistant embedded in a financial modeling platform. You have deep knowledge of:
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

export async function streamCopilotToResponse(
  modelId: string,
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  res: import("express").Response,
  isDisconnected: () => boolean
): Promise<void> {
  const context = await gatherModelContext(modelId);

  if (!context) {
    res.write(`data: ${JSON.stringify({ content: "I couldn't find the financial model. Please select a company from the sidebar first." })}\n\n`);
    return;
  }

  const contextMessage = `Here is the current financial model data for ${context.company.name} (${context.company.ticker || "no ticker"}):\n\n${JSON.stringify(context, null, 2)}`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
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
