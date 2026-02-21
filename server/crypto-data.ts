import { db } from "./db";
import { defillamaCache } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEFILLAMA_BASE = "https://api.llama.fi";
const MESSARI_BASE = "https://api.messari.io";

const DL_CACHE_TTL_MS = 60 * 60 * 1000;

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

let lastCoinGeckoCall = 0;
const MIN_CALL_INTERVAL_MS = 2500;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCoinGeckoCall;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
  }
  lastCoinGeckoCall = Date.now();
  return fetch(url);
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await throttledFetch(url);
    if (res.ok) return res;
    if (res.status === 429 && attempt < retries) {
      const wait = Math.min((attempt + 1) * 3000, 15000);
      console.log(`[CoinGecko] Rate limited, waiting ${wait}ms before retry ${attempt + 1}/${retries}`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      if (res.status === 429) throw new Error("RATE_LIMITED");
      throw new Error(`API_ERROR_${res.status}`);
    }
  }
  throw new Error("API_ERROR");
}

export async function searchCoins(query: string): Promise<CoinGeckoSearchResult[]> {
  const res = await fetchWithRetry(`${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`);
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

const COINGECKO_PLATFORMS = [
  "ethereum",
  "binance-smart-chain",
  "polygon-pos",
  "arbitrum-one",
  "avalanche",
  "base",
  "optimistic-ethereum",
  "solana",
  "fantom",
];

function isEvmAddress(q: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(q);
}

function isSolanaAddress(q: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
}

function looksLikeContractAddress(q: string): boolean {
  return isEvmAddress(q) || isSolanaAddress(q);
}

export async function searchCoinByContract(address: string): Promise<CoinGeckoSearchResult | null> {
  const platforms = isEvmAddress(address)
    ? COINGECKO_PLATFORMS.filter(p => p !== "solana")
    : ["solana"];

  const lookupAddress = isEvmAddress(address) ? address.toLowerCase() : address;

  for (const platform of platforms) {
    try {
      const res = await fetchWithRetry(`${COINGECKO_BASE}/coins/${platform}/contract/${lookupAddress}`);
      const data = await res.json();
      if (data.id) {
        return {
          id: data.id,
          name: data.name,
          symbol: (data.symbol || "").toUpperCase(),
          market_cap_rank: data.market_cap_rank || null,
          thumb: data.image?.thumb || "",
          large: data.image?.large || "",
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export { looksLikeContractAddress };

async function fetchCoinMarketDataFromApi(coingeckoId: string): Promise<CoinGeckoMarketData | null> {
  const res = await fetchWithRetry(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}&sparkline=true&price_change_percentage=7d`
  );
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return data[0];
}

export async function getCoinMarketData(coingeckoId: string): Promise<CoinGeckoMarketData | null> {
  return fetchCoinMarketDataFromApi(coingeckoId);
}

export async function getMultipleCoinMarketData(ids: string[]): Promise<CoinGeckoMarketData[]> {
  if (ids.length === 0) return [];
  const idsStr = ids.join(",");
  const res = await fetchWithRetry(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsStr)}&sparkline=true&price_change_percentage=7d`
  );
  const data: CoinGeckoMarketData[] = await res.json();
  return data;
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

const CHAIN_ID_TO_COINGECKO_PLATFORM: Record<number, string> = {
  1: "ethereum",
  137: "polygon-pos",
  10: "optimistic-ethereum",
  42161: "arbitrum-one",
  8453: "base",
  43114: "avalanche",
  56: "binance-smart-chain",
  solana: "solana",
} as any;

const COINGECKO_PLATFORM_TO_CHAIN: Record<string, { chainId: number | string; chainName: string }> = {
  "ethereum": { chainId: 1, chainName: "Ethereum" },
  "polygon-pos": { chainId: 137, chainName: "Polygon" },
  "optimistic-ethereum": { chainId: 10, chainName: "Optimism" },
  "arbitrum-one": { chainId: 42161, chainName: "Arbitrum" },
  "base": { chainId: 8453, chainName: "Base" },
  "avalanche": { chainId: 43114, chainName: "Avalanche" },
  "binance-smart-chain": { chainId: 56, chainName: "BSC" },
  "solana": { chainId: "solana", chainName: "Solana" },
};

interface CoinContractInfo {
  address: string;
  chainId: number | string;
  chainName: string;
  isEvm: boolean;
}

export async function getCoinContractAddress(coingeckoId: string): Promise<CoinContractInfo | null> {
  try {
    const res = await fetchWithRetry(`${COINGECKO_BASE}/coins/${encodeURIComponent(coingeckoId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
    const data = await res.json();
    const platforms: Record<string, string> = data.platforms || {};

    const evmPriorityOrder = [1, 137, 42161, 8453, 10, 43114, 56];
    for (const chainId of evmPriorityOrder) {
      const platform = CHAIN_ID_TO_COINGECKO_PLATFORM[chainId];
      if (platform && platforms[platform] && platforms[platform].length > 0) {
        return {
          address: platforms[platform],
          chainId,
          chainName: COINGECKO_PLATFORM_TO_CHAIN[platform]?.chainName || platform,
          isEvm: true,
        };
      }
    }

    if (platforms["solana"] && platforms["solana"].length > 0) {
      return {
        address: platforms["solana"],
        chainId: "solana",
        chainName: "Solana",
        isEvm: false,
      };
    }

    for (const [platform, address] of Object.entries(platforms)) {
      if (address && address.length > 0) {
        const mapped = COINGECKO_PLATFORM_TO_CHAIN[platform];
        const isEvm = mapped ? typeof mapped.chainId === "number" : false;
        return {
          address,
          chainId: mapped?.chainId ?? platform,
          chainName: mapped?.chainName || platform,
          isEvm,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("CoinGecko contract address lookup error:", err);
    return null;
  }
}

export interface BurnEstimate {
  totalBurned: number;
  burnPercent: number;
  hasBurnProgram: boolean;
  source: "max_supply_delta" | "supply_gap" | "none";
}

export function estimateBurnFromSupply(
  totalSupply: number | null | undefined,
  maxSupply: number | null | undefined,
  circulatingSupply: number | null | undefined
): BurnEstimate {
  const total = totalSupply || 0;
  const max = maxSupply || 0;
  const circulating = circulatingSupply || 0;

  if (max > 0 && total > 0 && max > total) {
    const burned = max - total;
    const burnPercent = (burned / max) * 100;
    return {
      totalBurned: burned,
      burnPercent,
      hasBurnProgram: burnPercent > 0.1,
      source: "max_supply_delta",
    };
  }

  if (total > 0 && circulating > 0 && total > circulating) {
    return {
      totalBurned: 0,
      burnPercent: 0,
      hasBurnProgram: false,
      source: "supply_gap",
    };
  }

  return {
    totalBurned: 0,
    burnPercent: 0,
    hasBurnProgram: false,
    source: "none",
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

async function getDlCache(protocolId: string, metricType: string): Promise<any | null> {
  try {
    const rows = await db.select().from(defillamaCache)
      .where(and(eq(defillamaCache.protocolId, protocolId), eq(defillamaCache.metricType, metricType)))
      .limit(1);
    if (rows.length > 0 && (Date.now() - new Date(rows[0].fetchedAt).getTime()) < DL_CACHE_TTL_MS) {
      return rows[0].data;
    }
  } catch (e) {}
  return null;
}

async function setDlCache(protocolId: string, metricType: string, data: unknown): Promise<void> {
  try {
    await db.insert(defillamaCache)
      .values({ protocolId, metricType, data: data as any })
      .onConflictDoUpdate({
        target: [defillamaCache.protocolId, defillamaCache.metricType],
        set: { data: data as any, fetchedAt: new Date() },
      });
  } catch (e) {}
}

export async function getProtocolTVLHistory(slug: string): Promise<{ date: string; tvl: number }[]> {
  const cached = await getDlCache(slug, "tvl");
  if (cached) return cached as any;

  const res = await fetch(`${DEFILLAMA_BASE}/protocol/${encodeURIComponent(slug)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const tvls = data.tvl || [];
  const result = tvls.slice(-365).map((entry: any) => ({
    date: new Date(entry.date * 1000).toISOString().split("T")[0],
    tvl: entry.totalLiquidityUSD || 0,
  }));
  await setDlCache(slug, "tvl", result);
  return result;
}

export async function getProtocolFees(slug: string): Promise<{ date: string; dailyFees: number; dailyRevenue: number }[]> {
  try {
    const cached = await getDlCache(slug, "fees");
    if (cached) return cached as any;

    const res = await fetch(`${DEFILLAMA_BASE}/summary/fees/${encodeURIComponent(slug)}?dataType=dailyFees`);
    if (!res.ok) return [];
    const data = await res.json();
    const totalDataChart = data.totalDataChart || [];
    const result = totalDataChart.slice(-365).map((entry: any) => ({
      date: new Date(entry[0] * 1000).toISOString().split("T")[0],
      dailyFees: entry[1] || 0,
      dailyRevenue: (entry[1] || 0) * 0.3,
    }));
    await setDlCache(slug, "fees", result);
    return result;
  } catch {
    return [];
  }
}

export async function getProtocolRevenue(slug: string): Promise<{ date: string; dailyRevenue: number }[]> {
  try {
    const cached = await getDlCache(slug, "revenue");
    if (cached) return cached as any;

    const res = await fetch(`${DEFILLAMA_BASE}/summary/fees/${encodeURIComponent(slug)}?dataType=dailyRevenue`);
    if (!res.ok) return [];
    const data = await res.json();
    const totalDataChart = data.totalDataChart || [];
    const result = totalDataChart.slice(-365).map((entry: any) => ({
      date: new Date(entry[0] * 1000).toISOString().split("T")[0],
      dailyRevenue: entry[1] || 0,
    }));
    await setDlCache(slug, "revenue", result);
    return result;
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
  ripple: [
    { role: "Validators (Unique Node List)", contribution: "Validate transactions via Ripple Protocol Consensus Algorithm", rewardType: "None (voluntary)", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "XRP validators do not receive block rewards. They operate voluntarily to support the network. No inflation from validation." },
    { role: "Payment Users / Financial Institutions", contribution: "Use XRP as bridge currency for cross-border payments", rewardType: "Fast settlement (~3-5 seconds), low fees", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "XRP's primary utility is as a bridge asset in cross-border payments via RippleNet/ODL. Transaction fees are burned, creating mild deflationary pressure." },
    { role: "Developers", contribution: "Build on the XRP Ledger (DEX, NFTs, AMM, sidechains)", rewardType: "Grants, ecosystem funding", rewardSource: "Ripple Labs + XRPL Grants Program", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Ripple Labs funds developer grants from its large XRP reserves. XRPL has native DEX, AMM, and NFT support." },
    { role: "Liquidity Providers (XRPL AMM)", contribution: "Provide liquidity to the native on-ledger AMM pools", rewardType: "Trading Fees", rewardSource: "Protocol Fees from AMM swaps", allocationPercent: 0, estimatedApy: 3, vestingMonths: null, isSustainable: true, sustainabilityNotes: "XRPL native AMM launched in 2024. LP yields come from trading fees, not token emissions. Sustainability depends on trading volume." },
    { role: "Ripple Labs (Token Distribution)", contribution: "Holds large XRP reserves for ecosystem development", rewardType: "Strategic distribution", rewardSource: "Initial token allocation + monthly escrow releases", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: false, sustainabilityNotes: "Ripple holds ~40B+ XRP in escrow, releasing up to 1B per month. Unsold portions are re-escrowed. This creates persistent sell-side overhang and dilution risk." },
  ],
  stellar: [
    { role: "Developers (Soroban & Core)", contribution: "Build dApps, smart contracts, and tools on Soroban and core network", rewardType: "Grants, bounties, ecosystem funding", rewardSource: "Stellar Development Foundation (SDF)", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "SDF provides substantial grants for projects improving functionality, interoperability, and RWA tokenization on Soroban (Stellar's smart contract platform)." },
    { role: "Security Researchers / Bug Bounties", contribution: "Identify vulnerabilities in Stellar protocol or Soroban", rewardType: "Bug bounty rewards (up to $150K in XLM for critical findings)", rewardSource: "Stellar Development Foundation", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Bug bounty program offers significant rewards for critical vulnerability disclosure. Funded by SDF treasury." },
    { role: "Validators (Nodes)", contribution: "Operate validator nodes for Stellar Consensus Protocol (SCP)", rewardType: "None (voluntary, no block rewards)", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "No inflationary block rewards. Validators operate for ecosystem integrity or self-interest. Lower barrier than proof-of-work." },
    { role: "Liquidity Providers", contribution: "Add liquidity to SDEX or support asset-to-asset pairs including XLM", rewardType: "Trading Fees + Aquarius incentives", rewardSource: "DEX fees + Aquarius Protocol rewards", allocationPercent: 0, estimatedApy: 5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "SDEX has no LP token emissions. Aquarius protocol provides incentives for selected pools. Fee-based yields depend on trading volume." },
    { role: "Ecosystem Contributors", contribution: "Develop wallets, on/off-ramps, education, marketing", rewardType: "Grants, funding, token allocations", rewardSource: "SDF + ecosystem grant programs", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "SDF funds ecosystem growth through grants, accelerators, and partnerships. Focus on financial inclusion and cross-border payments." },
    { role: "Anchor Operators", contribution: "Bridge real-world currencies to Stellar network as tokenized assets", rewardType: "Transaction fees, spread income", rewardSource: "User payments for fiat on/off-ramp services", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Anchors are regulated entities that issue tokenized fiat on Stellar. Revenue comes from conversion fees and spreads, not token emissions." },
  ],
  cardano: [
    { role: "Stake Pool Operators", contribution: "Run pools that validate transactions and produce blocks", rewardType: "ADA Staking Rewards + Pool Fees", rewardSource: "Token Emissions (reserves) + Transaction Fees", allocationPercent: 0, estimatedApy: 4.5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "ADA rewards come from a diminishing reserves pool (~8B ADA remaining) + transaction fees. Inflation decreases over time. No lock-up required for delegators." },
    { role: "Delegators (Stakers)", contribution: "Delegate ADA to stake pools for network security", rewardType: "ADA Staking Rewards", rewardSource: "Token Emissions + Transaction Fees", allocationPercent: 0, estimatedApy: 3.5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Liquid staking - ADA is never locked. ~70% of circulating supply is staked. Rewards auto-compound each epoch (5 days)." },
    { role: "Developers (Plutus/Marlowe)", contribution: "Build dApps and smart contracts on Cardano", rewardType: "Grants, Project Catalyst funding", rewardSource: "Cardano Treasury (funded by transaction fees)", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Project Catalyst is one of the largest decentralized funding programs. Treasury receives 20% of all transaction fees. Community votes on proposals." },
    { role: "Governance Participants (Voltaire)", contribution: "Vote on protocol changes and treasury spending via on-chain governance", rewardType: "Governance Power + potential voting rewards", rewardSource: "Treasury", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Cardano's Voltaire era enables full on-chain governance. DReps (Delegated Representatives) vote on protocol parameters and treasury spending." },
  ],
  polkadot: [
    { role: "Validators", contribution: "Validate parachain blocks and secure the relay chain", rewardType: "DOT Staking Rewards", rewardSource: "Token Emissions (~7-8% inflation)", allocationPercent: 0, estimatedApy: 15, vestingMonths: null, isSustainable: true, sustainabilityNotes: "DOT has ~7-8% annual inflation. Optimal staking ratio targets 50% of supply staked. Validators earn higher APY but face slashing risk." },
    { role: "Nominators (Stakers)", contribution: "Stake DOT to back trusted validators", rewardType: "DOT Staking Rewards", rewardSource: "Token Emissions", allocationPercent: 0, estimatedApy: 12, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Nominators share rewards with validators. 28-day unbonding period. Slashing risk if backed validator misbehaves." },
    { role: "Parachain Teams", contribution: "Build specialized blockchains connected to Polkadot relay chain", rewardType: "Shared security, cross-chain interoperability", rewardSource: "DOT slot auctions / coretime purchases", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Parachains lease slots via DOT auctions (2-year terms) or purchase coretime. DOT locked during lease, not burned." },
    { role: "Governance Participants", contribution: "Vote on referenda via OpenGov system", rewardType: "Governance Power + Treasury spending allocation", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "OpenGov allows any DOT holder to propose and vote. Treasury receives inflation not distributed to stakers. Active governance community." },
  ],
  "matic-network": [
    { role: "Validators", contribution: "Validate transactions on Polygon PoS chain", rewardType: "MATIC/POL Staking Rewards + Transaction Fees", rewardSource: "Token Emissions + Protocol Fees", allocationPercent: 0, estimatedApy: 5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Polygon migrated from MATIC to POL token. POL has 2% annual emissions split between validators and a community treasury. Transition from MATIC is ongoing." },
    { role: "Delegators (Stakers)", contribution: "Stake MATIC/POL to validators for network security", rewardType: "Staking Rewards", rewardSource: "Token Emissions", allocationPercent: 0, estimatedApy: 4, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Delegators earn proportional rewards minus validator commission. No lock-up for staking but 80-checkpoint unbonding period (~2 days)." },
    { role: "Developers", contribution: "Build dApps on Polygon PoS, zkEVM, and CDK chains", rewardType: "Grants, ecosystem funding", rewardSource: "Polygon Labs + Community Treasury", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Polygon invests heavily in ZK technology (zkEVM, Miden, Type 1 prover). Developer grants available for building on any Polygon chain." },
    { role: "ZK Provers", contribution: "Generate zero-knowledge proofs for zkEVM and AggLayer", rewardType: "POL emissions + proof fees", rewardSource: "Token Emissions + Protocol Fees", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "As Polygon shifts to ZK-based scaling, provers will be a key participant. POL token redesigned to support multi-chain staking and proving roles." },
  ],
  avalanche: [
    { role: "Validators", contribution: "Validate transactions on C-Chain, X-Chain, and P-Chain", rewardType: "AVAX Staking Rewards", rewardSource: "Token Emissions (capped supply of 720M)", allocationPercent: 0, estimatedApy: 8, vestingMonths: null, isSustainable: true, sustainabilityNotes: "AVAX has a capped supply of 720M. Staking rewards come from unminted supply, decreasing over time. 2000 AVAX minimum to validate, 14-day minimum stake period." },
    { role: "Delegators", contribution: "Delegate AVAX to validators for network security", rewardType: "AVAX Staking Rewards", rewardSource: "Token Emissions", allocationPercent: 0, estimatedApy: 7, vestingMonths: null, isSustainable: true, sustainabilityNotes: "25 AVAX minimum to delegate. Lock period of 2 weeks to 1 year. Validators charge 2-20% delegation fee." },
    { role: "Subnet Creators", contribution: "Launch custom blockchains (Subnets/L1s) on Avalanche", rewardType: "Custom tokenomics, shared security", rewardSource: "Subnet-specific token models", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Subnets allow custom VMs and validator sets. AVAX burned to create subnets. Gaming, DeFi, and enterprise subnets driving adoption." },
    { role: "Users / Fee Payers", contribution: "Pay transaction fees on C-Chain and subnets", rewardType: "Access to DeFi, gaming, NFTs", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "All C-Chain transaction fees are 100% burned, creating deflationary pressure. Subnet fees vary by implementation." },
  ],
  chainlink: [
    { role: "Node Operators", contribution: "Provide oracle data feeds, VRF, automation, and CCIP services", rewardType: "LINK payments from data consumers + staking rewards", rewardSource: "Protocol Fees + Token Emissions (staking)", allocationPercent: 0, estimatedApy: 5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Node operators earn LINK from protocols consuming oracle data. Chainlink Staking v0.2 launched with ~$700M+ staked. Economics shifting toward fee-based sustainability." },
    { role: "Stakers", contribution: "Stake LINK in staking pools to secure oracle network", rewardType: "Staking Rewards", rewardSource: "Token Emissions + Protocol Fees", allocationPercent: 0, estimatedApy: 4.5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Staking v0.2 introduced slashing for underperformance. APY from combination of emissions and fee sharing. Pool capped at 45M LINK initially." },
    { role: "Data Consumers (DeFi Protocols)", contribution: "Pay LINK for price feeds, VRF randomness, automation", rewardType: "Reliable oracle data for smart contracts", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Chainlink is the dominant oracle provider, securing $75B+ in DeFi TVL. Revenue from CCIP (cross-chain), Data Feeds, VRF, and Automation growing." },
    { role: "CCIP Users", contribution: "Use Cross-Chain Interoperability Protocol for cross-chain messaging", rewardType: "Cross-chain token transfers and messaging", rewardSource: "N/A (fees paid in LINK)", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "CCIP is a major revenue driver. Fees paid in LINK for cross-chain transactions. Adopted by major institutions (SWIFT integration)." },
  ],
  litecoin: [
    { role: "Miners", contribution: "Secure the network via Scrypt proof-of-work", rewardType: "Block Rewards + Transaction Fees", rewardSource: "Token Emissions (halving every ~4 years)", allocationPercent: 100, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "LTC block rewards halve every 840,000 blocks. Last halving Aug 2023 to 6.25 LTC/block. Merge-mined with DOGE provides additional miner incentive." },
    { role: "Node Operators", contribution: "Validate transactions and relay blocks", rewardType: "None (voluntary)", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Like Bitcoin, Litecoin nodes are operated voluntarily. MimbleWimble Extension Blocks (MWEB) added optional privacy features." },
    { role: "Users / Merchants", contribution: "Use LTC for payments and transactions", rewardType: "Fast settlement (~2.5 min blocks), low fees", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Litecoin positions itself as 'digital silver' to Bitcoin's 'gold'. Faster block times and lower fees make it suitable for payments. 84M total supply cap." },
  ],
  "bitcoin-cash": [
    { role: "Miners", contribution: "Secure the network via SHA-256 proof-of-work", rewardType: "Block Rewards + Transaction Fees", rewardSource: "Token Emissions (halving schedule)", allocationPercent: 100, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "BCH shares Bitcoin's halving schedule. Larger block size (32MB) enables more transactions per block. Competes with BTC for SHA-256 mining hash power." },
    { role: "Users / Merchants", contribution: "Use BCH for peer-to-peer electronic cash transactions", rewardType: "Very low fees, fast confirmation", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "BCH focuses on peer-to-peer cash use case with larger blocks. CashTokens enable fungible and non-fungible tokens on BCH. 21M supply cap." },
    { role: "Developers", contribution: "Build applications using CashScript and CashTokens", rewardType: "Community grants, ecosystem funding", rewardSource: "BCHN & community donations", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "BCH developer funding is community-driven without a central foundation or treasury. Flipstarter crowdfunding used for protocol development." },
  ],
  dogecoin: [
    { role: "Miners", contribution: "Secure the network via Scrypt proof-of-work (merged mining with LTC)", rewardType: "Block Rewards (10,000 DOGE/block, no cap)", rewardSource: "Perpetual Token Emissions", allocationPercent: 100, estimatedApy: null, vestingMonths: null, isSustainable: false, sustainabilityNotes: "DOGE has no supply cap and emits ~5.2B new DOGE/year. However, the inflation rate decreases over time as a percentage of total supply. Merged mining with Litecoin provides security." },
    { role: "Community / Holders", contribution: "Drive adoption, tipping, and cultural narrative", rewardType: "Community membership, tipping culture", rewardSource: "Market sentiment and adoption", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: false, sustainabilityNotes: "No staking, no yield, no protocol revenue. Value driven entirely by community, memes, and notable endorsements. High inflation makes it poor store of value long-term." },
    { role: "Users / Tippers", contribution: "Use DOGE for tips, micro-payments, and merchant payments", rewardType: "Very low fees, fast block times (1 minute)", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "DOGE has very low transaction fees making it suitable for micro-payments and tipping. Several major merchants accept DOGE." },
  ],
  cosmos: [
    { role: "Validators", contribution: "Validate blocks on Cosmos Hub (Tendermint BFT)", rewardType: "ATOM Staking Rewards + Transaction Fees", rewardSource: "Token Emissions (variable inflation 7-20%)", allocationPercent: 0, estimatedApy: 18, vestingMonths: null, isSustainable: true, sustainabilityNotes: "ATOM inflation adjusts between 7-20% to target 67% staking ratio. Higher inflation when staking is low, lower when high. Top 180 validators earn rewards." },
    { role: "Delegators (Stakers)", contribution: "Stake ATOM to validators for Hub security", rewardType: "ATOM Staking Rewards", rewardSource: "Token Emissions + Transaction Fees", allocationPercent: 0, estimatedApy: 15, vestingMonths: null, isSustainable: true, sustainabilityNotes: "21-day unbonding period. Slashing risk if validator double-signs or goes offline. Liquid staking options available (stATOM, stkATOM)." },
    { role: "IBC Relayers", contribution: "Relay cross-chain messages between Cosmos chains via IBC protocol", rewardType: "Transaction fees from relayed packets", rewardSource: "Protocol Fees", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "IBC is the backbone of Cosmos interoperability. Relayers earn fees for forwarding packets. Most relay services operate at thin margins." },
    { role: "App-Chain Builders", contribution: "Build sovereign blockchains using Cosmos SDK", rewardType: "Custom tokenomics, IBC connectivity", rewardSource: "Own chain's token model", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Cosmos SDK enables sovereign app-chains (Osmosis, dYdX, Stride, etc.). Each chain has its own tokenomics. ATOM's value proposition is interchain security and IBC hub." },
  ],
  tron: [
    { role: "Super Representatives", contribution: "Produce blocks and validate transactions (27 SRs elected)", rewardType: "TRX Block Rewards + Voting Rewards", rewardSource: "Token Emissions (~5B TRX/year)", allocationPercent: 0, estimatedApy: 7, vestingMonths: null, isSustainable: true, sustainabilityNotes: "27 Super Representatives elected by TRX voters produce blocks. SRs earn 32 TRX per block + voting rewards. TRX burned from fees often exceeds emissions, making TRX deflationary." },
    { role: "Voters (Stakers)", contribution: "Freeze TRX and vote for Super Representatives", rewardType: "Voting Rewards (shared by SRs)", rewardSource: "SR reward sharing + Token Emissions", allocationPercent: 0, estimatedApy: 4, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Voters freeze TRX to gain Energy/Bandwidth and vote for SRs. SRs share portion of rewards with voters. 14-day unstaking period." },
    { role: "Users (Stablecoin Transfers)", contribution: "Use TRON for USDT/USDC transfers with low fees", rewardType: "Low-cost stablecoin transfers", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "TRON is the #1 chain for USDT transfers. Transaction fees are burned, driving deflation. TRON processes more USDT volume than any other chain." },
  ],
  "wrapped-bitcoin": [
    { role: "Merchants (Custodians)", contribution: "Custody BTC and mint/burn WBTC tokens 1:1", rewardType: "Minting/burning fees", rewardSource: "Protocol Fees from wrap/unwrap transactions", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "WBTC is a wrapped version of Bitcoin on Ethereum. Merchants hold BTC in custody and mint equivalent WBTC. Users pay fees to wrap/unwrap." },
    { role: "DeFi Users", contribution: "Use WBTC as collateral in lending, DEX, and yield protocols", rewardType: "DeFi yields, leverage, liquidity", rewardSource: "Individual DeFi protocol rewards", allocationPercent: 0, estimatedApy: 2, vestingMonths: null, isSustainable: true, sustainabilityNotes: "WBTC allows BTC holders to participate in Ethereum DeFi. Yields come from lending, LP fees, and protocol incentives. Custody risk is the main concern." },
  ],
  "lido-dao": [
    { role: "ETH Stakers (stETH Holders)", contribution: "Stake ETH through Lido and receive liquid staking token", rewardType: "ETH Staking Rewards (stETH rebasing)", rewardSource: "Ethereum Protocol Emissions + Tips", allocationPercent: 0, estimatedApy: 3.5, vestingMonths: null, isSustainable: true, sustainabilityNotes: "stETH accrues staking rewards automatically. Lido takes 10% fee (5% to node operators, 5% to Lido DAO treasury). Largest liquid staking protocol." },
    { role: "Node Operators", contribution: "Run Ethereum validators on behalf of Lido stakers", rewardType: "5% of staking rewards", rewardSource: "Protocol fee split", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "Curated set of professional node operators. Lido V2 introduced staking router for permissionless module additions." },
    { role: "LDO Governance", contribution: "Vote on protocol parameters, node operator onboarding, fee structure", rewardType: "Governance Power over largest DeFi protocol by TVL", rewardSource: "N/A", allocationPercent: 0, estimatedApy: null, vestingMonths: null, isSustainable: true, sustainabilityNotes: "LDO holders govern a protocol managing 9M+ ETH. Treasury receives 5% of all staking rewards. Strong revenue but LDO token has no direct fee sharing." },
  ],
};

// ===================== Token Allocation Data =====================

interface AllocationEntry {
  category: string;
  standardGroup: string;
  percentage: number;
  amount: number | null;
  vestingMonths: number | null;
  cliffMonths: number | null;
  tgePercent: number | null;
  vestingType: string;
  assumption: string;
  description: string;
  references: string;
}

interface TokenAllocationData {
  totalSupply: number;
  allocations: AllocationEntry[];
}

function inferStandardGroup(recipient: string): string {
  const lower = recipient.toLowerCase();
  if (/team|founder|contributor|core|advisor|partner/i.test(lower)) return "team";
  if (/investor|seed|private|strategic|series|venture|vc/i.test(lower)) return "investors";
  if (/public|ico|ieo|ido|launchpad|sale/i.test(lower)) return "public";
  if (/treasury|reserve|foundation|dao|protocol/i.test(lower)) return "treasury";
  return "community";
}

const CURATED_ALLOCATIONS: Record<string, TokenAllocationData> = {
  "aave": {
    totalSupply: 16000000,
    allocations: [
      { category: "LEND to AAVE Migrator", standardGroup: "community", percentage: 81.25, amount: 13000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Inferred On-chain", description: "13 million AAVE tokens redeemed by LEND token holders at 100:1 ratio", references: "https://etherscan.io, https://github.com/aave/aave-token" },
      { category: "AAVE Ecosystem Reserve", standardGroup: "treasury", percentage: 18.75, amount: 3000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Vesting Contract", description: "3 million AAVE allocated to the Aave Ecosystem Reserve for protocol development", references: "https://etherscan.io, https://github.com/aave/aave-token" },
    ],
  },
  "avalanche": {
    totalSupply: 720000000,
    allocations: [
      { category: "Staking Rewards", standardGroup: "community", percentage: 50, amount: 360000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Protocol Emission", description: "360M AVAX distributed to validators and delegators over 10+ years", references: "https://build.avax.network/docs/quick-start/avax-token" },
      { category: "Team", standardGroup: "team", percentage: 10, amount: 72000000, vestingMonths: 48, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Team allocation with 4-year vesting, now fully unlocked", references: "https://icodrops.com/avalanche/" },
      { category: "Foundation", standardGroup: "treasury", percentage: 9.26, amount: 66672000, vestingMonths: 120, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "10-year linear vesting through 2030, quarterly unlocks (~1.67M AVAX per quarter)", references: "https://build.avax.network/docs/quick-start/avax-token" },
      { category: "Public Sale (A1+A2+B)", standardGroup: "public", percentage: 9.97, amount: 71784000, vestingMonths: 18, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Combined public sales: Option A1 (1%), A2 (8.3% at $0.50, 18-mo vest), B (0.67% at $0.85, no lockup)", references: "https://icodrops.com/avalanche/" },
      { category: "Community & Development", standardGroup: "community", percentage: 7, amount: 50400000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Fully unlocked community endowment for development programs", references: "https://build.avax.network/docs/quick-start/avax-token" },
      { category: "Strategic Partners", standardGroup: "investors", percentage: 5, amount: 36000000, vestingMonths: 48, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Strategic partner allocation with multi-year vesting", references: "https://icodrops.com/avalanche/" },
      { category: "Private Sale", standardGroup: "investors", percentage: 3.5, amount: 25200000, vestingMonths: 18, cliffMonths: null, tgePercent: 10, vestingType: "linear", assumption: "Public Project Data", description: "Private sale with 10% at launch, rest quarterly over 18 months", references: "https://icodrops.com/avalanche/" },
      { category: "Seed Sale", standardGroup: "investors", percentage: 2.5, amount: 18000000, vestingMonths: 18, cliffMonths: null, tgePercent: 10, vestingType: "linear", assumption: "Public Project Data", description: "Seed round with 10% at launch, rest quarterly over 18 months", references: "https://icodrops.com/avalanche/" },
      { category: "Airdrop", standardGroup: "community", percentage: 2.5, amount: 18000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Early community airdrop distribution", references: "https://icodrops.com/avalanche/" },
      { category: "Testnet Incentive Program", standardGroup: "community", percentage: 0.27, amount: 1944000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Rewards for early testnet participants", references: "https://icodrops.com/avalanche/" },
    ],
  },
  "tron": {
    totalSupply: 100000000000,
    allocations: [
      { category: "Public Sale (ICO)", standardGroup: "public", percentage: 40, amount: 40000000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "40B TRX sold in September 2017 ICO, all unlocked at TGE", references: "https://icodrops.com/tron/, https://developers.tron.network/docs/tron-economic-model" },
      { category: "Private & Early Investors", standardGroup: "investors", percentage: 15.7, amount: 15700000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Private placement and early investor allocation, all unlocked at TGE", references: "https://icodrops.com/tron/" },
      { category: "TRON Foundation / DAO", standardGroup: "treasury", percentage: 24.3, amount: 24300000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Foundation reserve for governance and long-term protocol development, all unlocked", references: "https://developers.tron.network/docs/tron-economic-model" },
      { category: "Ecosystem Development", standardGroup: "community", percentage: 10, amount: 10000000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Developer incentives, dApp grants, and ecosystem growth programs", references: "https://developers.tron.network/docs/tron-economic-model" },
      { category: "Company (Justin Sun)", standardGroup: "team", percentage: 10, amount: 10000000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Founder and company allocation, all unlocked", references: "https://icodrops.com/tron/" },
    ],
  },
  "mantle": {
    totalSupply: 6220000000,
    allocations: [
      { category: "BitDAO Token Holders (BIT Migration)", standardGroup: "community", percentage: 52, amount: 3234400000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Inferred On-chain", description: "Former BitDAO BIT holders who migrated 1:1 to MNT in July 2023. Includes original BIT public sale, Bybit Launchpad, and secondary market holders. All vesting completed by 2023.", references: "https://docs.mantle.xyz/governance/parameters/tokenomics" },
      { category: "Mantle Treasury", standardGroup: "treasury", percentage: 47.4, amount: 2948280000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "DAO-governed treasury for ecosystem fund ($200M+), DeFi incentives, partnerships, and grants. Requires governance approval via Budget Proposals.", references: "https://docs.mantle.xyz/governance/parameters/tokenomics" },
      { category: "Core Budget", standardGroup: "team", percentage: 0.6, amount: 37320000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Operational expenses for core contributors, drawn from treasury with governance approval", references: "https://docs.mantle.xyz/governance/parameters/tokenomics" },
    ],
  },
  "provenance": {
    totalSupply: 100000000000,
    allocations: [
      { category: "Figure Technologies", standardGroup: "team", percentage: 42.6, amount: 42600000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Figure Technologies founding allocation. Originally 71%, reduced after returning 40% of holdings (~28.4B HASH) to Foundation in Q1 2025 to support decentralization.", references: "https://www.provenance.io/whitepaper-tokenomics" },
      { category: "Foundation / Administrator", standardGroup: "treasury", percentage: 52.4, amount: 52400000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Provenance Blockchain Foundation. Originally 24%, expanded after receiving 40% of Figure's tokens in 2025. Funds ecosystem grants, community incentives, HASH Rank rewards (15% quarterly), and milestone airdrops (2%).", references: "https://www.provenance.io/whitepaper-tokenomics" },
      { category: "Validators & Node Operators", standardGroup: "community", percentage: 5, amount: 5000000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Staking rewards for validators. 60% of network fees go to validators. Dynamic inflation 1-52.5% based on staking participation (target 60% staked). Winning HASH auction bids are burned.", references: "https://docs.provenance.io/learn/the-hash-token" },
    ],
  },
  "bitcoin": {
    totalSupply: 21000000,
    allocations: [
      { category: "Block Rewards (Mining)", standardGroup: "community", percentage: 100, amount: 21000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Protocol Emission", description: "All 21M BTC distributed via proof-of-work mining. Block reward halves every 210,000 blocks (~4 years). ~19.9M mined as of 2025.", references: "https://bitcoin.org/bitcoin.pdf" },
    ],
  },
  "ethereum": {
    totalSupply: 72009990.5,
    allocations: [
      { category: "Crowdsale Participants", standardGroup: "public", percentage: 83.33, amount: 60000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "60M ETH sold in July-August 2014 crowdsale at ~$0.31 per ETH", references: "https://blog.ethereum.org/2014/07/22/launching-the-ether-sale" },
      { category: "Ethereum Foundation", standardGroup: "treasury", percentage: 8.33, amount: 6000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "6M ETH allocated to Ethereum Foundation for development", references: "https://blog.ethereum.org/2014/07/22/launching-the-ether-sale" },
      { category: "Early Contributors", standardGroup: "team", percentage: 8.33, amount: 6009990.5, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "~6M ETH allocated to early contributors and developers", references: "https://blog.ethereum.org/2014/07/22/launching-the-ether-sale" },
    ],
  },
  "solana": {
    totalSupply: 589000000,
    allocations: [
      { category: "Seed Round", standardGroup: "investors", percentage: 16.23, amount: 95600000, vestingMonths: 24, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Seed investors, 12-month cliff then 24-month linear vest", references: "https://solana.com/solana-whitepaper.pdf, https://messari.io/project/solana" },
      { category: "Founding Sale", standardGroup: "investors", percentage: 12.92, amount: 76100000, vestingMonths: 24, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Founding round investors", references: "https://messari.io/project/solana" },
      { category: "Team", standardGroup: "team", percentage: 12.79, amount: 75300000, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Core team allocation with 12-month cliff and 48-month vesting", references: "https://messari.io/project/solana" },
      { category: "Foundation", standardGroup: "treasury", percentage: 10.46, amount: 61600000, vestingMonths: 48, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Solana Foundation for ecosystem development", references: "https://solana.org" },
      { category: "Validator Sale", standardGroup: "investors", percentage: 5.18, amount: 30500000, vestingMonths: 24, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Validator sale participants", references: "https://messari.io/project/solana" },
      { category: "Community Reserve", standardGroup: "community", percentage: 38.89, amount: 229000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Community and ecosystem incentives including staking rewards", references: "https://solana.org" },
      { category: "Strategic Sale", standardGroup: "investors", percentage: 1.88, amount: 11100000, vestingMonths: 24, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Strategic round", references: "https://messari.io/project/solana" },
      { category: "Auction (CoinList)", standardGroup: "public", percentage: 1.64, amount: 9650000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "CoinList public auction, 100% released at TGE", references: "https://coinlist.co/solana" },
    ],
  },
  "uniswap": {
    totalSupply: 1000000000,
    allocations: [
      { category: "Community Governance", standardGroup: "community", percentage: 43, amount: 430000000, vestingMonths: 48, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "43% for community governance treasury, vesting over 4 years", references: "https://blog.uniswap.org/uni" },
      { category: "Team & Employees", standardGroup: "team", percentage: 21.266, amount: 212660000, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Vesting Contract", description: "Team with 1-year cliff and 4-year total vesting", references: "https://blog.uniswap.org/uni, https://etherscan.io" },
      { category: "Investors", standardGroup: "investors", percentage: 18.044, amount: 180440000, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Vesting Contract", description: "Investors with 1-year cliff and 4-year total vesting", references: "https://blog.uniswap.org/uni" },
      { category: "Advisors", standardGroup: "team", percentage: 0.69, amount: 6900000, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Vesting Contract", description: "Advisors with 1-year cliff and 4-year total vesting", references: "https://blog.uniswap.org/uni" },
      { category: "Community Airdrop", standardGroup: "community", percentage: 15, amount: 150000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Inferred On-chain", description: "15% airdropped to historical users (400 UNI per address)", references: "https://blog.uniswap.org/uni" },
      { category: "Liquidity Mining", standardGroup: "community", percentage: 2, amount: 20000000, vestingMonths: 2, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Initial liquidity mining program", references: "https://blog.uniswap.org/uni" },
    ],
  },
  "arbitrum": {
    totalSupply: 10000000000,
    allocations: [
      { category: "DAO Treasury", standardGroup: "treasury", percentage: 42.78, amount: 4278000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "DAO treasury controlled by governance", references: "https://docs.arbitrum.foundation/airdrop-eligibility-distribution" },
      { category: "Team & Advisors", standardGroup: "team", percentage: 26.94, amount: 2694000000, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Team and advisors with 1-year cliff and 4-year vesting", references: "https://docs.arbitrum.foundation/airdrop-eligibility-distribution" },
      { category: "Investors", standardGroup: "investors", percentage: 17.53, amount: 1753000000, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Investors with 1-year cliff and 4-year vesting", references: "https://docs.arbitrum.foundation/airdrop-eligibility-distribution" },
      { category: "Airdrop", standardGroup: "community", percentage: 11.62, amount: 1162000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Inferred On-chain", description: "Community airdrop to eligible addresses", references: "https://docs.arbitrum.foundation/airdrop-eligibility-distribution" },
      { category: "DAOs in Ecosystem", standardGroup: "community", percentage: 1.13, amount: 113000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Airdrop to DAOs building on Arbitrum", references: "https://docs.arbitrum.foundation/airdrop-eligibility-distribution" },
    ],
  },
  "optimism": {
    totalSupply: 4294967296,
    allocations: [
      { category: "Ecosystem Fund", standardGroup: "treasury", percentage: 25, amount: 1073741824, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Ecosystem fund for grants, partnerships, and growth", references: "https://community.optimism.io/docs/governance/allocations/" },
      { category: "Retroactive Public Goods", standardGroup: "community", percentage: 20, amount: 858993459, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Funding public goods retroactively via RPGF rounds", references: "https://community.optimism.io/docs/governance/allocations/" },
      { category: "Core Contributors", standardGroup: "team", percentage: 19, amount: 816044186, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Core team with 1-year cliff and 4-year vesting", references: "https://community.optimism.io/docs/governance/allocations/" },
      { category: "Investors", standardGroup: "investors", percentage: 17, amount: 730144440, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", assumption: "Public Project Data", description: "Investors with 1-year cliff and 4-year vesting", references: "https://community.optimism.io/docs/governance/allocations/" },
      { category: "Airdrop", standardGroup: "community", percentage: 19, amount: 816044186, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Inferred On-chain", description: "Community airdrop across multiple seasons", references: "https://community.optimism.io/docs/governance/allocations/" },
    ],
  },
  "chainlink": {
    totalSupply: 1000000000,
    allocations: [
      { category: "Node Operators & Ecosystem", standardGroup: "community", percentage: 35, amount: 350000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Reserved for node operator rewards and ecosystem incentives", references: "https://chain.link/whitepaper" },
      { category: "Public Token Sale", standardGroup: "public", percentage: 35, amount: 350000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Sold in September 2017 ICO at $0.11 per LINK", references: "https://chain.link/whitepaper" },
      { category: "Company (Chainlink Labs)", standardGroup: "team", percentage: 30, amount: 300000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Retained by Chainlink Labs for development and operations", references: "https://chain.link/whitepaper" },
    ],
  },
  "polygon": {
    totalSupply: 10000000000,
    allocations: [
      { category: "Staking Rewards", standardGroup: "community", percentage: 12, amount: 1200000000, vestingMonths: 60, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Staking rewards distributed over 5 years", references: "https://polygon.technology/papers/pol-whitepaper" },
      { category: "Team", standardGroup: "team", percentage: 16, amount: 1600000000, vestingMonths: 48, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Team allocation vesting over 4 years", references: "https://polygon.technology" },
      { category: "Advisors", standardGroup: "team", percentage: 4, amount: 400000000, vestingMonths: 48, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Advisors vesting over 4 years", references: "https://polygon.technology" },
      { category: "Ecosystem", standardGroup: "treasury", percentage: 23.33, amount: 2333000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Ecosystem development fund", references: "https://polygon.technology" },
      { category: "Foundation", standardGroup: "treasury", percentage: 21.86, amount: 2186000000, vestingMonths: null, cliffMonths: null, tgePercent: null, vestingType: "custom", assumption: "Public Project Data", description: "Foundation reserve for long-term development", references: "https://polygon.technology" },
      { category: "Launchpad & IEO", standardGroup: "public", percentage: 19, amount: 1900000000, vestingMonths: null, cliffMonths: null, tgePercent: 100, vestingType: "immediate", assumption: "Public Project Data", description: "Binance Launchpad IEO (April 2019) and private sales", references: "https://www.binance.com/en/research/projects/matic-network" },
      { category: "Private Sale", standardGroup: "investors", percentage: 3.8, amount: 380000000, vestingMonths: 24, cliffMonths: null, tgePercent: null, vestingType: "linear", assumption: "Public Project Data", description: "Early private sale investors", references: "https://polygon.technology" },
    ],
  },
};

const ALLOCATION_ALIASES: Record<string, string> = {
  "btc": "bitcoin", "eth": "ethereum", "sol": "solana", "uni": "uniswap",
  "link": "chainlink", "arb": "arbitrum", "op": "optimism", "matic": "polygon",
  "pol": "polygon", "avax": "avalanche", "trx": "tron", "tron-network": "tron",
  "mnt": "mantle", "hash": "provenance", "hash-2": "provenance",
  "provenance-blockchain": "provenance",
};

export function lookupCuratedAllocations(symbolOrSlug: string): TokenAllocationData | null {
  const key = symbolOrSlug.toLowerCase().trim();
  if (CURATED_ALLOCATIONS[key]) return CURATED_ALLOCATIONS[key];
  if (ALLOCATION_ALIASES[key] && CURATED_ALLOCATIONS[ALLOCATION_ALIASES[key]]) {
    return CURATED_ALLOCATIONS[ALLOCATION_ALIASES[key]];
  }
  return null;
}

export function mapCuratedToAllocations(data: TokenAllocationData, projectId: string): Record<string, unknown>[] {
  return data.allocations.map((a, i) => ({
    projectId,
    category: a.category,
    standardGroup: a.standardGroup,
    percentage: a.percentage,
    amount: a.amount,
    vestingMonths: a.vestingMonths,
    cliffMonths: a.cliffMonths,
    tgePercent: a.tgePercent,
    vestingType: a.vestingType,
    dataSource: a.assumption || "Curated",
    releasedPercent: null,
    releasedAmount: null,
    precision: null,
    assumption: a.assumption || null,
    references: a.references || null,
    description: a.description || null,
    notes: null,
    sortOrder: i,
  }));
}

// ===================== OpenAI Allocation Research Service =====================

interface AIAllocationResult {
  allocations: AllocationEntry[];
  totalSupply: number | null;
  tgeDate: string | null;
  confidence: "high" | "medium" | "low";
  notes: string;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]") return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host)) return false;
    if (host === "metadata.google.internal" || host === "169.254.169.254") return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchSourceContent(url: string): Promise<{ url: string; content: string | null }> {
  if (!isAllowedUrl(url)) {
    console.log(`Data source ${url}: blocked (private/internal URL)`);
    return { url, content: null };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return { url, content: null };
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 200 || /enable javascript/i.test(text) || /just a moment/i.test(text) || /cf_chl/i.test(text)) {
      console.log(`Data source ${url}: page requires JavaScript or is blocked, content not available via fetch`);
      return { url, content: null };
    }
    return { url, content: text.slice(0, 8000) };
  } catch (err) {
    console.log(`Failed to fetch data source ${url}:`, (err as Error).message);
    return { url, content: null };
  }
}

export async function researchAllocationsWithAI(
  tokenName: string,
  tokenSymbol: string,
  totalSupply: number | null,
  dataSources?: string[] | null,
): Promise<AIAllocationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("OpenAI API key not configured, skipping AI research");
    return null;
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const supplyContext = totalSupply
    ? `The token has a total/max supply of ${totalSupply.toLocaleString()} tokens.`
    : "Total supply is unknown.";

  let sourcesContext = "";
  if (dataSources && dataSources.length > 0) {
    const fetchResults = await Promise.all(dataSources.map(fetchSourceContent));
    const fetchedParts: string[] = [];
    const unfetchedUrls: string[] = [];
    for (const result of fetchResults) {
      if (result.content) {
        fetchedParts.push(`--- Source: ${result.url} ---\n${result.content}\n--- End Source ---`);
      } else {
        unfetchedUrls.push(result.url);
      }
    }
    if (fetchedParts.length > 0) {
      sourcesContext = `\nThe user has provided the following reference sources for this project. Extract allocation data from this content as your PRIMARY source of truth:\n\n${fetchedParts.join("\n\n")}\n`;
    }
    if (unfetchedUrls.length > 0) {
      sourcesContext += `\nThe following reference URLs were provided but could not be fetched (JavaScript-rendered pages). If you have knowledge of the content at these URLs from your training data, use that information as your primary source for allocation data:\n${unfetchedUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n`;
    }
  }

  const prompt = `You are a cryptocurrency tokenomics analyst. Research and provide the known token allocation breakdown for the cryptocurrency "${tokenName}" (symbol: ${tokenSymbol}).

${supplyContext}
${sourcesContext}
Return a JSON object with this exact structure:
{
  "allocations": [
    {
      "category": "Category Name",
      "standardGroup": "one of: team, investors, public, treasury, community",
      "percentage": 20.0,
      "vestingMonths": 48 or null,
      "cliffMonths": 12 or null,
      "tgePercent": 0 or null,
      "vestingType": "one of: linear, cliff, immediate, custom",
      "description": "Brief description of this allocation bucket and vesting terms",
      "references": "Known sources: whitepaper URLs, blog posts, documentation links"
    }
  ],
  "totalSupply": 1000000000 or null,
  "tgeDate": "YYYY-MM-DD or null if unknown",
  "confidence": "high if well-documented major token, medium if publicly known but less documented, low if uncertain",
  "notes": "Brief note about data quality and any caveats"
}

Rules:
- Percentages MUST sum to exactly 100%
- If reference source content is provided above, extract allocation data directly from it -- this is the most reliable data
- Otherwise, use data from the project's whitepaper, documentation, ICO/token sale details, and public announcements
- Use the ACTUAL allocation category names from the project's documentation (e.g. "Ecosystem Growth & Rewards", "Marketing & Development", "Contributors & Advisors", "Strategic Sale", "Liquidity Mining"). Do NOT use generic names -- use the real names the project published.
- Include vesting schedules if known (vestingMonths = total vesting duration AFTER the cliff ends, cliffMonths = initial lockup before any tokens release)
- tgePercent = percentage of that allocation released at Token Generation Event (launch)
- tgeDate = the date when the token was first launched/generated (Token Generation Event). This is critical for accurate vesting schedule calculations. Use YYYY-MM-DD format. If unknown, set to null.
- standardGroup must be one of: team, investors, public, treasury, community
- If you don't have reliable data for this token, set confidence to "low" and provide your best estimate based on similar projects
- For references, include specific URLs when known (whitepaper, blog posts, official docs)
- Return ONLY valid JSON, no markdown or explanation`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AIAllocationResult;

    if (!parsed.allocations || !Array.isArray(parsed.allocations) || parsed.allocations.length === 0) {
      return null;
    }

    const totalPct = parsed.allocations.reduce((sum, a) => sum + (a.percentage || 0), 0);
    if (totalPct < 90 || totalPct > 110) {
      console.log(`AI allocation percentages sum to ${totalPct}%, expected ~100%`);
    }

    return parsed;
  } catch (err) {
    console.error("OpenAI allocation research error:", err);
    return null;
  }
}

export function mapAIToAllocations(
  data: AIAllocationResult,
  projectId: string,
  totalSupply: number | null,
): Record<string, unknown>[] {
  const supply = totalSupply || data.totalSupply || null;
  return data.allocations.map((a, i) => ({
    projectId,
    category: a.category,
    standardGroup: a.standardGroup || inferStandardGroup(a.category),
    percentage: Math.round((a.percentage || 0) * 100) / 100,
    amount: supply ? Math.round(supply * (a.percentage / 100)) : null,
    vestingMonths: a.vestingMonths || null,
    cliffMonths: a.cliffMonths || null,
    tgePercent: a.tgePercent ?? null,
    vestingType: a.vestingType || "custom",
    dataSource: `AI-Researched (${data.confidence} confidence)`,
    releasedPercent: null,
    releasedAmount: null,
    precision: null,
    assumption: `AI-Researched (${data.confidence})`,
    references: a.references || null,
    description: a.description || null,
    notes: data.notes || null,
    sortOrder: i,
  }));
}

export interface AIFundraisingRound {
  roundType: string;
  amount: number | null;
  valuation: number | null;
  date: string | null;
  leadInvestors: string | null;
  tokenPrice: number | null;
  notes: string | null;
}

export interface AIFundraisingResult {
  rounds: AIFundraisingRound[];
  confidence: string;
  notes: string;
}

export async function researchFundraisingWithAI(
  tokenName: string,
  tokenSymbol: string,
  dataSources?: string[] | null,
): Promise<AIFundraisingResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("OpenAI API key not configured, skipping AI fundraising research");
    return null;
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  let sourcesContext = "";
  if (dataSources && dataSources.length > 0) {
    const fetchResults = await Promise.all(dataSources.map(fetchSourceContent));
    const fetchedParts: string[] = [];
    const unfetchedUrls: string[] = [];
    for (const result of fetchResults) {
      if (result.content) {
        fetchedParts.push(`--- Source: ${result.url} ---\n${result.content}\n--- End Source ---`);
      } else {
        unfetchedUrls.push(result.url);
      }
    }
    if (fetchedParts.length > 0) {
      sourcesContext = `\nThe user has provided the following reference sources. Extract fundraising round data from this content as your PRIMARY source of truth:\n\n${fetchedParts.join("\n\n")}\n`;
    }
    if (unfetchedUrls.length > 0) {
      sourcesContext += `\nThe following reference URLs were provided but could not be fetched (JavaScript-rendered pages). If you have knowledge of the content at these URLs from your training data, use that information as your primary source:\n${unfetchedUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n`;
    }
  }

  const prompt = `You are a cryptocurrency fundraising analyst. Research and provide the known fundraising history for the cryptocurrency "${tokenName}" (symbol: ${tokenSymbol}).
${sourcesContext}
Return a JSON object with this exact structure:
{
  "rounds": [
    {
      "roundType": "e.g. Seed, Private, Series A, Series B, Strategic, Public Sale, ICO, IEO, IDO, Pre-seed",
      "amount": 5000000 or null (USD raised in this round),
      "valuation": 50000000 or null (fully diluted valuation at time of round, in USD),
      "date": "2021-03" or "2021-Q1" or "2021" or null (as precise as known),
      "leadInvestors": "Investor A, Investor B" or null (comma-separated lead investors),
      "tokenPrice": 0.05 or null (token price at this round in USD),
      "notes": "Brief description of terms or notable details" or null
    }
  ],
  "confidence": "high if well-documented major token, medium if publicly known but less documented, low if uncertain",
  "notes": "Brief note about data quality and any caveats"
}

Rules:
- Order rounds chronologically from earliest to latest
- Include ALL known funding rounds (seed, private, public, strategic, etc.)
- For Bitcoin, Ethereum, and other tokens that did not have traditional VC fundraising, return an empty rounds array with a note explaining the token's launch mechanism
- If reference source content is provided above, extract fundraising data directly from it
- Otherwise use data from CryptoRank, ICO Drops, Crunchbase, PitchBook, news articles, and official announcements from your training data
- Amounts should be in USD
- For references, include specific data sources in notes when known
- If you don't have reliable data, set confidence to "low" and provide your best estimate
- Return ONLY valid JSON, no markdown or explanation`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AIFundraisingResult;
    if (!parsed.rounds || !Array.isArray(parsed.rounds)) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("OpenAI fundraising research error:", err);
    return null;
  }
}

export function mapAIToFundraisingRounds(
  data: AIFundraisingResult,
  projectId: string,
): Record<string, unknown>[] {
  return data.rounds.map((r, i) => ({
    projectId,
    roundType: r.roundType,
    amount: r.amount || null,
    valuation: r.valuation || null,
    date: r.date || null,
    leadInvestors: r.leadInvestors || null,
    tokenPrice: r.tokenPrice || null,
    notes: r.notes ? `${r.notes} [AI-Researched: ${data.confidence} confidence]` : `AI-Researched (${data.confidence} confidence)`,
    sortOrder: i,
  }));
}

export interface AISupplyEvent {
  eventType: string;
  label: string;
  date: string | null;
  amount: number;
  isRecurring: boolean;
  recurringIntervalMonths: number | null;
  notes: string | null;
}

export interface AISupplyScheduleResult {
  events: AISupplyEvent[];
  confidence: string;
  notes: string;
}

export async function researchSupplyScheduleWithAI(
  tokenName: string,
  tokenSymbol: string,
  totalSupply: number | null,
  dataSources?: string[] | null,
): Promise<AISupplyScheduleResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("OpenAI API key not configured, skipping AI supply schedule research");
    return null;
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const supplyContext = totalSupply
    ? `The token has a total/max supply of ${totalSupply.toLocaleString()} tokens.`
    : "Total supply is unknown.";

  let sourcesContext = "";
  if (dataSources && dataSources.length > 0) {
    const fetchResults = await Promise.all(dataSources.map(fetchSourceContent));
    const fetchedParts: string[] = [];
    const unfetchedUrls: string[] = [];
    for (const result of fetchResults) {
      if (result.content) {
        fetchedParts.push(`--- Source: ${result.url} ---\n${result.content}\n--- End Source ---`);
      } else {
        unfetchedUrls.push(result.url);
      }
    }
    if (fetchedParts.length > 0) {
      sourcesContext = `\nThe user has provided the following reference sources. Extract supply/vesting schedule data from this content as your PRIMARY source of truth:\n\n${fetchedParts.join("\n\n")}\n`;
    }
    if (unfetchedUrls.length > 0) {
      sourcesContext += `\nThe following reference URLs were provided but could not be fetched (JavaScript-rendered pages). If you have knowledge of the content at these URLs from your training data, use that information as your primary source:\n${unfetchedUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n`;
    }
  }

  const prompt = `You are a cryptocurrency tokenomics analyst. Research and provide the known token supply/vesting/unlock schedule for the cryptocurrency "${tokenName}" (symbol: ${tokenSymbol}).

${supplyContext}
${sourcesContext}
Return a JSON object with this exact structure:
{
  "events": [
    {
      "eventType": "one of: tge, cliff_unlock, linear_vest, milestone_unlock, emission, burn, halving, airdrop, other",
      "label": "Descriptive label (e.g. 'Team Cliff Unlock', 'Ecosystem Linear Vest Start', 'TGE Public Sale', 'Mining Emission Q1 2024')",
      "date": "2021-03-15" or "2021-Q1" or "2021" or null (as precise as known),
      "amount": 50000000 (number of tokens involved in this event),
      "isRecurring": false (true if this repeats, like monthly unlocks),
      "recurringIntervalMonths": null or 1 or 3 or 12 (interval for recurring events),
      "notes": "Brief description of this unlock/vesting event" or null
    }
  ],
  "confidence": "high if well-documented major token, medium if publicly known but less documented, low if uncertain",
  "notes": "Brief note about data quality and any caveats"
}

Rules:
- Order events chronologically from earliest to latest
- Include major supply events: TGE (token generation event), cliff unlocks, vesting starts, large emission schedules, halvings, burns, airdrops
- For linear vesting, create one entry per vesting phase (e.g. "Team Linear Vest" with the total amount and recurringIntervalMonths set to the unlock frequency)
- eventType must be one of: tge, cliff_unlock, linear_vest, milestone_unlock, emission, burn, halving, airdrop, other
- amounts should be in token units (not USD)
- For Bitcoin and proof-of-work tokens, include block reward schedule and halvings
- If reference source content is provided above, extract schedule data directly from it
- Otherwise use data from whitepapers, official documentation, token unlock trackers (TokenUnlocks, Nansen), and public announcements from your training data
- If you don't have reliable data, set confidence to "low" and provide your best estimate
- Return ONLY valid JSON, no markdown or explanation`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AISupplyScheduleResult;
    if (!parsed.events || !Array.isArray(parsed.events)) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("OpenAI supply schedule research error:", err);
    return null;
  }
}

export function mapAIToSupplySchedule(
  data: AISupplyScheduleResult,
  projectId: string,
): Record<string, unknown>[] {
  return data.events.map((e, i) => ({
    projectId,
    eventType: e.eventType,
    label: e.label,
    date: e.date || null,
    amount: e.amount || 0,
    isRecurring: e.isRecurring || false,
    recurringIntervalMonths: e.recurringIntervalMonths || null,
    notes: e.notes ? `${e.notes} [AI-Researched: ${data.confidence} confidence]` : `AI-Researched (${data.confidence} confidence)`,
    sortOrder: i,
  }));
}
