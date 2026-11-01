import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { fetchSjc } from './fetch.js';
import { vnDate } from './parse.js';

initializeApp();
const db = getFirestore();

/**
 * Runs twice a day (Vietnam time). Writes one document per day at prices/{YYYY-MM-DD}.
 * The afternoon run overwrites the morning's "latest" values but keeps the day's high/low,
 * so the daily document ends up as a closing price plus the range seen.
 */
export const recordGoldPrice = onSchedule(
  {
    schedule: '15 9,15 * * *',
    timeZone: 'Asia/Ho_Chi_Minh',
    region: 'asia-southeast1',
    retryCount: 3,
  },
  async () => {
    const { prices, sourceUpdatedAt } = await fetchSjc();
    const day = vnDate();
    const ref = db.collection('prices').doc(day);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? snap.data() : null;
      const doc = { date: day, source: 'sjc.com.vn', sourceUpdatedAt, updatedAt: FieldValue.serverTimestamp() };
      for (const [type, q] of Object.entries(prices)) {
        const p = prev?.[type];
        doc[type] = {
          ...q,
          highSellPerChi: Math.max(q.sellPerChi, p?.highSellPerChi ?? 0),
          lowSellPerChi: Math.min(q.sellPerChi, p?.lowSellPerChi ?? Infinity),
        };
      }
      tx.set(ref, doc);
    });
    logger.info('Recorded gold price', { day, bar: prices.bar.sellPerChi, ring: prices.ring.sellPerChi });
  },
);
