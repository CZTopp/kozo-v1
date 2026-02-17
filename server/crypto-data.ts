const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEFILLAMA_BASE = "https://api.llama.fi";

interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
  large: string;
}

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_date: string;
  sparkline_in_7d?: { price: number[] };
}

export async function searchCoins(query: string): Promise<CoinGeckoSearchResult[]> {
  const res = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`CoinGecko search failed: ${res.status}`);
  const data = await res.json();
  return (data.coins || []).slice(0, 20).map((c: any) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    market_cap_rank: c.market_cap_rank,
    thumb: c.thumb,
    large: c.large,
  }));
}

export async function getCoinMarketData(coingeckoId: string): Promise<CoinGeckoMarketData | null> {
  const res = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}&sparkline=true&price_change_percentage=7d`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return data[0];
}

export async function getMultipleCoinMarketData(ids: string[]): Promise<CoinGeckoMarketData[]> {
  if (ids.length === 0) return [];
  const idsStr = ids.join(",");
  const res = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsStr)}&sparkline=true&price_change_percentage=7d`
  );
  if (!res.ok) return [];
  return res.json();
}

export function mapCoinGeckoToProject(coin: CoinGeckoMarketData) {
  return {
    coingeckoId: coin.id,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    currentPrice: coin.current_price || 0,
    marketCap: coin.market_cap || 0,
    fullyDilutedValuation: coin.fully_diluted_valuation || 0,
    volume24h: coin.total_volume || 0,
    priceChange24h: coin.price_change_percentage_24h || 0,
    priceChange7d: coin.price_change_percentage_7d_in_currency || 0,
    circulatingSupply: coin.circulating_supply || 0,
    totalSupply: coin.total_supply,
    maxSupply: coin.max_supply,
    ath: coin.ath || 0,
    athDate: coin.ath_date || null,
    sparklineData: coin.sparkline_in_7d?.price || null,
    image: coin.image || null,
  };
}

interface DefiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  gecko_id: string | null;
  tvl: number;
  category: string;
  chains: string[];
}

export async function searchDefiLlamaProtocols(query: string): Promise<DefiLlamaProtocol[]> {
  const res = await fetch(`${DEFILLAMA_BASE}/protocols`);
  if (!res.ok) return [];
  const protocols: any[] = await res.json();
  const q = query.toLowerCase();
  return protocols
    .filter((p: any) => p.name?.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q))
    .slice(0, 20)
    .map((p: any) => ({
      id: p.id || p.slug,
      name: p.name,
      slug: p.slug,
      gecko_id: p.gecko_id,
      tvl: p.tvl || 0,
      category: p.category || "Unknown",
      chains: p.chains || [],
    }));
}

export async function getProtocolTVLHistory(slug: string): Promise<{ date: string; tvl: number }[]> {
  const res = await fetch(`${DEFILLAMA_BASE}/protocol/${encodeURIComponent(slug)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const tvls = data.tvl || [];
  return tvls.slice(-365).map((entry: any) => ({
    date: new Date(entry.date * 1000).toISOString().split("T")[0],
    tvl: entry.totalLiquidityUSD || 0,
  }));
}

export async function getProtocolFees(slug: string): Promise<{ date: string; dailyFees: number; dailyRevenue: number }[]> {
  try {
    const res = await fetch(`${DEFILLAMA_BASE}/summary/fees/${encodeURIComponent(slug)}?dataType=dailyFees`);
    if (!res.ok) return [];
    const data = await res.json();
    const totalDataChart = data.totalDataChart || [];
    return totalDataChart.slice(-365).map((entry: any) => ({
      date: new Date(entry[0] * 1000).toISOString().split("T")[0],
      dailyFees: entry[1] || 0,
      dailyRevenue: (entry[1] || 0) * 0.3,
    }));
  } catch {
    return [];
  }
}

export async function getProtocolRevenue(slug: string): Promise<{ date: string; dailyRevenue: number }[]> {
  try {
    const res = await fetch(`${DEFILLAMA_BASE}/summary/fees/${encodeURIComponent(slug)}?dataType=dailyRevenue`);
    if (!res.ok) return [];
    const data = await res.json();
    const totalDataChart = data.totalDataChart || [];
    return totalDataChart.slice(-365).map((entry: any) => ({
      date: new Date(entry[0] * 1000).toISOString().split("T")[0],
      dailyRevenue: entry[1] || 0,
    }));
  } catch {
    return [];
  }
}

export interface IncentiveTemplate {
  role: string;
  contribution: string;
  rewardType: string;
  rewardSource: string;
  allocationPercent: number;
  estimatedApy: number | null;
  vestingMonths: number | null;
  isSustainable: boolean;
  sustainabilityNotes: string;
}

export const INCENTIVE_TEMPLATES: Record<string, IncentiveTemplate[]> = {
  bitcoin: [
    { role: "Miners", contribution: "Secure the network via proof-of-work", rewardType: "Block Rewards + Transaction Fees", rewardSource: "Token Emissions (halving every ~4 years)", allocationPercent: 100, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Block rewards halve every ~210,000 blocks. As emissions decrease, transaction fees must sustain miners. Currently ~98% of rewards from block subsidies." },
    { role: "Node Operators", contribution: "Validate transactions and maintain consensus", rewardType: "None (voluntary)", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Nodes are operated altruistically or for self-interest (validating own transactions). No direct token incentive." },
    { role: "Holders", contribution: "Store of value, provide liquidity", rewardType: "Price Appreciation", rewardSource: "Market Demand", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "No yield. Value driven by scarcity (21M cap) and adoption." },
  ],
  ethereum: [
    { role: "Validators (Stakers)", contribution: "Secure the network via proof-of-stake (32 ETH minimum)", rewardType: "Staking Rewards + Priority Fees + MEV", rewardSource: "Token Emissions + Protocol Fees", allocationPercent: 0, estimatedApy: 3.5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Post-Merge, ETH issuance dropped ~90%. EIP-1559 burns base fees, making ETH deflationary during high usage. Staking APY is sustainable from issuance + tips." },
    { role: "Users", contribution: "Pay gas fees to use the network", rewardType: "Access to dApps and DeFi", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Gas fees are the primary revenue source for the network. Base fee is burned (deflationary), priority fee goes to validators." },
    { role: "Developers", contribution: "Build dApps, protocols, and infrastructure", rewardType: "Grants, token allocations from projects", rewardSource: "Ethereum Foundation Grants + Ecosystem Projects", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Ethereum Foundation has multi-year treasury. Individual project grants vary." },
    { role: "Liquidity Providers", contribution: "Supply capital to DEX pools", rewardType: "Trading Fees + LP Token Rewards", rewardSource: "Protocol Fees + Token Emissions from individual protocols", allocationPercent: 0, estimatedApy: 5, vestingMonths: null, isSustainable: false, sustainabilityNotes: "LP incentives depend on individual protocols. Many rely on token emissions which dilute over time. Fee-only APY tends to be lower but more sustainable." },
  ],
  solana: [
    { role: "Validators", contribution: "Process transactions and produce blocks", rewardType: "Staking Rewards + Transaction Fees", rewardSource: "Token Emissions + Protocol Fees", allocationPercent: 0, estimatedApy: 6.5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "SOL has ongoing inflation (currently ~5.5%, decreasing 15% annually). 50% of transaction fees burned, 50% to validators. Long-term sustainability depends on fee revenue growth." },
    { role: "Delegators (Stakers)", contribution: "Stake SOL to validators for network security", rewardType: "Staking Rewards (proportional)", rewardSource: "Token Emissions", allocationPercent: 0, estimatedApy: 6.0, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Staking is liquid via LSTs (mSOL, jitoSOL). Yield comes from inflation, so real yield depends on staking participation rate." },
    { role: "Users", contribution: "Pay transaction fees", rewardType: "Fast, cheap transactions", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Transaction fees are very low (~$0.00025). High throughput enables high fee volume despite low per-tx cost." },
  ],
  uniswap: [
    { role: "Liquidity Providers", contribution: "Supply token pairs to AMM pools", rewardType: "Trading Fees (0.3% per swap)", rewardSource: "Protocol Fees from traders", allocationPercent: 0, estimatedApy: 8, vestingMonths: null, isSustainable: true, sustainabilityNotes: "LP fees are purely from trading activity - no token emissions needed. Sustainable as long as trading volume exists. Impermanent loss is the main risk." },
    { role: "UNI Token Holders", contribution: "Governance voting on protocol changes", rewardType: "Governance Power", rewardSource: "N/A (no fee switch activated yet)", allocationPercent: 60, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "UNI has no staking yield currently. The 'fee switch' could redirect ~0.05% of swap fees to UNI holders but hasn't been activated. Governance is the primary utility." },
    { role: "Team & Investors", contribution: "Protocol development and funding", rewardType: "Token Allocation", rewardSource: "Initial Token Distribution", allocationPercent: 40, estimatedApy: null, vestingMonths: 48, isSustainable: true, sustainabilityNotes: "Team/investor tokens were vested over 4 years (fully vested by Sep 2024). No ongoing emissions." },
  ],
  aave: [
    { role: "Lenders (Depositors)", contribution: "Supply assets to lending pools", rewardType: "Interest from borrowers + AAVE rewards", rewardSource: "Protocol Fees + Token Emissions", allocationPercent: 0, estimatedApy: 4, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Interest rates are market-driven (supply/demand). AAVE emission incentives supplement but are decreasing over time." },
    { role: "Borrowers", contribution: "Pay interest on borrowed assets", rewardType: "Access to leverage and liquidity", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Borrowing demand drives protocol revenue. Interest rates float based on utilization." },
    { role: "AAVE Stakers (Safety Module)", contribution: "Stake AAVE as backstop insurance for protocol shortfall", rewardType: "Staking Rewards", rewardSource: "Token Emissions + Protocol Fees", allocationPercent: 0, estimatedApy: 5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Safety Module acts as insurance. If a shortfall event occurs, staked AAVE can be slashed. Risk-adjusted yield." },
    { role: "Governance", contribution: "Vote on protocol parameters, risk management", rewardType: "Governance Power", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "AAVE holders govern interest rate models, collateral parameters, and treasury management." },
  ],
};
