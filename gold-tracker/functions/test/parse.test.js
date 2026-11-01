import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSjc, vnDate } from '../src/parse.js';

// Shape of SJC's PriceService.ashx response, with prices from 2026-11-01.
const sample = {
  success: true,
  latestDate: '13:53 01/11/2026',
  data: [
    { TypeName: 'Vàng SJC 1L, 10L, 1KG', BranchName: 'Hồ Chí Minh', Buy: '136,000', BuyValue: 136000000, Sell: '139,000', SellValue: 139000000 },
    { TypeName: 'Vàng SJC 1L, 10L, 1KG', BranchName: 'Hà Nội', Buy: '136,000', BuyValue: 136000000, Sell: '139,020', SellValue: 139020000 },
    { TypeName: 'Vàng nhẫn SJC 99,99% 1 chỉ, 2 chỉ, 5 chỉ', BranchName: 'Hồ Chí Minh', Buy: '131,800', BuyValue: 131800000, Sell: '135,800', SellValue: 135800000 },
    { TypeName: 'Vàng nhẫn SJC 99,99% 1 chỉ, 2 chỉ, 5 chỉ', BranchName: 'Hà Nội', Buy: '131,800', BuyValue: 131800000, Sell: '135,820', SellValue: 135820000 },
    { TypeName: 'Nữ trang 99,99%', BranchName: 'Hồ Chí Minh', Buy: '130,000', BuyValue: 130000000, Sell: '134,000', SellValue: 134000000 },
  ],
};

test('converts lượng prices to chỉ', () => {
  const p = parseSjc(sample);
  assert.equal(p.bar.sellPerChi, 13_900_000);
  assert.equal(p.bar.buyPerChi, 13_600_000);
  assert.equal(p.ring.sellPerChi, 13_580_000);
  assert.equal(p.ring.buyPerChi, 13_180_000);
});

test('reads only the requested branch', () => {
  assert.equal(parseSjc(sample, 'Hà Nội').bar.sellPerLuong, 139_020_000);
});

test('falls back to display strings when numeric values are missing', () => {
  const data = sample.data.map(({ BuyValue, SellValue, ...r }) => r);
  assert.equal(parseSjc({ ...sample, data }).bar.sellPerLuong, 139_000_000);
});

test('rejects implausible or inverted prices', () => {
  const bad = structuredClone(sample);
  bad.data[0].SellValue = 139; // unit slip
  assert.throws(() => parseSjc(bad), /Implausible/);
  const inverted = structuredClone(sample);
  inverted.data[0].BuyValue = 140_000_000;
  assert.throws(() => parseSjc(inverted), /buy .* > sell/);
});

test('rejects malformed payloads', () => {
  assert.throws(() => parseSjc({ success: false }));
  assert.throws(() => parseSjc({ success: true, data: [] }), /no row/);
});

test('vnDate uses Vietnam time', () => {
  // 18:00 UTC on Oct 31 is already Nov 1 in Vietnam (UTC+7).
  assert.equal(vnDate(new Date('2026-10-31T18:00:00Z')), '2026-11-01');
});
