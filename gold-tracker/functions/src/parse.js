// Pure parsing logic for SJC's price feed. No I/O here so it can be unit-tested.
//
// SJC quotes prices in VND per lượng (1 lượng = 10 chỉ = 37.5 g).
// "buy" = what the shop pays you; "sell" = what you pay the shop.

export const CHI_PER_LUONG = 10;

// Which SJC product rows we track, matched against TypeName.
const TYPES = {
  bar: (name) => /vàng\s*sjc\s*1l/i.test(name),
  ring: (name) => /nhẫn/i.test(name) && /99[,.]99/.test(name),
};

// Anything outside this band is almost certainly a parsing error, not a real price.
const MIN_PER_LUONG = 20_000_000;
const MAX_PER_LUONG = 1_000_000_000;

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    // "136,000" means 136,000 nghìn đồng/lượng (thousands of VND) in SJC's display strings.
    const n = Number(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n * 1000 : NaN;
  }
  return NaN;
}

/**
 * @param {object} payload  JSON body returned by SJC's PriceService.ashx
 * @param {string} branch   Branch to read (prices differ slightly by city)
 * @returns {{ bar: Quote, ring: Quote }} prices per lượng and per chỉ
 */
export function parseSjc(payload, branch = 'Hồ Chí Minh') {
  if (!payload || payload.success === false || !Array.isArray(payload.data)) {
    throw new Error('SJC response missing data[]');
  }
  const rows = payload.data.filter((r) => !r.BranchName || r.BranchName === branch);
  const out = {};
  for (const [key, match] of Object.entries(TYPES)) {
    const row = rows.find((r) => match(String(r.TypeName ?? '')));
    if (!row) throw new Error(`SJC response has no row for "${key}" in branch ${branch}`);
    const buy = row.BuyValue ?? toNumber(row.Buy);
    const sell = row.SellValue ?? toNumber(row.Sell);
    validate(key, buy, sell);
    out[key] = {
      name: row.TypeName,
      buyPerLuong: buy,
      sellPerLuong: sell,
      buyPerChi: Math.round(buy / CHI_PER_LUONG),
      sellPerChi: Math.round(sell / CHI_PER_LUONG),
    };
  }
  return out;
}

function validate(key, buy, sell) {
  for (const [label, v] of [['buy', buy], ['sell', sell]]) {
    if (!Number.isFinite(v) || v < MIN_PER_LUONG || v > MAX_PER_LUONG) {
      throw new Error(`Implausible ${key} ${label} price: ${v}`);
    }
  }
  if (buy > sell) throw new Error(`${key}: buy (${buy}) > sell (${sell}) — data looks wrong`);
}

/** Vietnam calendar date (YYYY-MM-DD) for a given instant. */
export function vnDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}
