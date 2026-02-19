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

export async function getCoinMarketData(coingeckoId: string): Promise<CoinGeckoMarketData | null> {
  const res = await fetchWithRetry(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}&sparkline=true&price_change_percentage=7d`
  );
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return data[0];
}

export async function getMultipleCoinMarketData(ids: string[]): Promise<CoinGeckoMarketData[]> {
  if (ids.length === 0) return [];
  const idsStr = ids.join(",");
  const res = await fetchWithRetry(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsStr)}&sparkline=true&price_change_percentage=7d`
  );
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

const CHAIN_ID_TO_COINGECKO_PLATFORM: Record<number, string> = {
  1: "ethereum",
  137: "polygon-pos",
  10: "optimistic-ethereum",
  42161: "arbitrum-one",
  8453: "base",
  43114: "avalanche",
  56: "binance-smart-chain",
};

interface CoinContractInfo {
  address: string;
  chainId: number;
  chainName: string;
}

export async function getCoinContractAddress(coingeckoId: string): Promise<CoinContractInfo | null> {
  try {
    const res = await fetchWithRetry(`${COINGECKO_BASE}/coins/${encodeURIComponent(coingeckoId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
    const data = await res.json();
    const platforms: Record<string, string> = data.platforms || {};

    const priorityOrder = [1, 137, 42161, 8453, 10, 43114, 56];
    for (const chainId of priorityOrder) {
      const platform = CHAIN_ID_TO_COINGECKO_PLATFORM[chainId];
      if (platform && platforms[platform] && platforms[platform].length > 0) {
        return {
          address: platforms[platform],
          chainId,
          chainName: platform,
        };
      }
    }

    for (const [platform, address] of Object.entries(platforms)) {
      if (address && address.length > 0) {
        const chainId = Object.entries(CHAIN_ID_TO_COINGECKO_PLATFORM)
          .find(([, name]) => name === platform)?.[0];
        return {
          address,
          chainId: chainId ? parseInt(chainId) : 1,
          chainName: platform,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("CoinGecko contract address lookup error:", err);
    return null;
  }
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
