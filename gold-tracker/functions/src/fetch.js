import { parseSjc } from './parse.js';

const SJC_URL = 'https://sjc.com.vn/GoldPrice/Services/PriceService.ashx';

export async function fetchSjc({ timeoutMs = 15_000 } = {}) {
  const res = await fetch(SJC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': 'Mozilla/5.0 (gold-tracker personal app)',
    },
    body: 'method=GetCurrentGoldPricesByBranch&BranchId=1',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`SJC HTTP ${res.status}`);
  const payload = await res.json();
  return { prices: parseSjc(payload), sourceUpdatedAt: payload.latestDate ?? null };
}
