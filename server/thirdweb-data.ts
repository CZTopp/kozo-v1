const THIRDWEB_INSIGHT_BASE = "https://insight.thirdweb.com/v1";

function getClientId(): string | undefined {
  return process.env.THIRDWEB_CLIENT_ID;
}

function getChainSlug(chainId: number): string {
  const chains: Record<number, string> = {
    1: "ethereum",
    137: "polygon",
    10: "optimism",
    42161: "arbitrum",
    8453: "base",
    43114: "avalanche",
    56: "bsc",
  };
  return chains[chainId] || "ethereum";
}

interface TokenTransfer {
  from: string;
  to: string;
  value: string;
  blockNumber: number;
  timestamp: number;
}

interface BurnData {
  totalBurned: number;
  recentBurnRate: number;
  burnEvents: number;
}

interface StakingData {
  stakedBalance: number;
  stakingRatio: number;
}

interface HolderConcentration {
  top10Percent: number;
  top50Percent: number;
  holderCount: number;
}

export async function getTokenBurnData(
  tokenAddress: string,
  chainId: number = 1,
  totalSupply?: number
): Promise<BurnData> {
  const clientId = getClientId();
  if (!clientId) {
    return { totalBurned: 0, recentBurnRate: 0, burnEvents: 0 };
  }

  try {
    const chain = getChainSlug(chainId);
    const deadAddress = "0x0000000000000000000000000000000000000000";
    const burnAddress = "0x000000000000000000000000000000000000dEaD";

    const url = `${THIRDWEB_INSIGHT_BASE}/${chain}/events/ERC20/Transfer?contract_address=${tokenAddress}&to=${deadAddress}&limit=100`;
    const url2 = `${THIRDWEB_INSIGHT_BASE}/${chain}/events/ERC20/Transfer?contract_address=${tokenAddress}&to=${burnAddress}&limit=100`;

    const headers: Record<string, string> = {
      "x-client-id": clientId,
    };

    const [res1, res2] = await Promise.all([
      fetch(url, { headers }).then(r => r.ok ? r.json() : { data: [] }),
      fetch(url2, { headers }).then(r => r.ok ? r.json() : { data: [] }),
    ]);

    const allBurns = [...(res1.data || []), ...(res2.data || [])];
    let totalBurned = 0;
    let recentBurns = 0;
    const thirtyDaysAgo = Date.now() / 1000 - 30 * 86400;

    for (const event of allBurns) {
      const value = parseFloat(event.decodedData?.value || event.value || "0");
      totalBurned += value;
      if (event.timestamp && event.timestamp > thirtyDaysAgo) {
        recentBurns += value;
      }
    }

    const annualizedBurnRate = recentBurns * 12;
    const burnRatePercent = totalSupply && totalSupply > 0
      ? (annualizedBurnRate / totalSupply) * 100
      : 0;

    return {
      totalBurned,
      recentBurnRate: burnRatePercent,
      burnEvents: allBurns.length,
    };
  } catch (err) {
    console.error("Thirdweb burn data error:", err);
    return { totalBurned: 0, recentBurnRate: 0, burnEvents: 0 };
  }
}

export async function getStakingData(
  stakingContractAddress: string,
  tokenAddress: string,
  chainId: number = 1,
  circulatingSupply?: number
): Promise<StakingData> {
  const clientId = getClientId();
  if (!clientId) {
    return { stakedBalance: 0, stakingRatio: 0 };
  }

  try {
    const chain = getChainSlug(chainId);
    const url = `${THIRDWEB_INSIGHT_BASE}/${chain}/tokens/erc20/${tokenAddress}/balances?owner_address=${stakingContractAddress}`;

    const headers: Record<string, string> = {
      "x-client-id": clientId,
    };

    const res = await fetch(url, { headers });
    if (!res.ok) return { stakedBalance: 0, stakingRatio: 0 };

    const data = await res.json();
    const balance = parseFloat(data.data?.[0]?.balance || "0");

    return {
      stakedBalance: balance,
      stakingRatio: circulatingSupply && circulatingSupply > 0
        ? (balance / circulatingSupply) * 100
        : 0,
    };
  } catch (err) {
    console.error("Thirdweb staking data error:", err);
    return { stakedBalance: 0, stakingRatio: 0 };
  }
}

export async function getTokenHolderConcentration(
  tokenAddress: string,
  chainId: number = 1,
  totalSupply?: number
): Promise<HolderConcentration> {
  const clientId = getClientId();
  if (!clientId) {
    return { top10Percent: 0, top50Percent: 0, holderCount: 0 };
  }

  try {
    const chain = getChainSlug(chainId);
    const url = `${THIRDWEB_INSIGHT_BASE}/${chain}/tokens/erc20/${tokenAddress}/holders?limit=50&sort_by=balance&sort_order=desc`;

    const headers: Record<string, string> = {
      "x-client-id": clientId,
    };

    const res = await fetch(url, { headers });
    if (!res.ok) return { top10Percent: 0, top50Percent: 0, holderCount: 0 };

    const data = await res.json();
    const holders = data.data || [];

    let top10Sum = 0;
    let top50Sum = 0;

    for (let i = 0; i < Math.min(holders.length, 50); i++) {
      const balance = parseFloat(holders[i]?.balance || "0");
      if (i < 10) top10Sum += balance;
      top50Sum += balance;
    }

    const supply = totalSupply || top50Sum || 1;

    return {
      top10Percent: (top10Sum / supply) * 100,
      top50Percent: (top50Sum / supply) * 100,
      holderCount: data.meta?.total || holders.length,
    };
  } catch (err) {
    console.error("Thirdweb holder concentration error:", err);
    return { top10Percent: 0, top50Percent: 0, holderCount: 0 };
  }
}

export async function getOnChainTokenData(
  tokenAddress: string,
  chainId: number = 1,
  stakingContract?: string,
  circulatingSupply?: number,
  totalSupply?: number
) {
  const [burnData, stakingData, concentration] = await Promise.all([
    getTokenBurnData(tokenAddress, chainId, totalSupply),
    stakingContract
      ? getStakingData(stakingContract, tokenAddress, chainId, circulatingSupply)
      : Promise.resolve({ stakedBalance: 0, stakingRatio: 0 } as StakingData),
    getTokenHolderConcentration(tokenAddress, chainId, totalSupply),
  ]);

  return {
    burns: burnData,
    staking: stakingData,
    concentration,
    hasThirdwebData: !!(getClientId()),
  };
}
