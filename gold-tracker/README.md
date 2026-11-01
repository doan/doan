# Gold Tracker (giá vàng theo chỉ)

Records SJC gold prices once a day into Firestore and shows them per **chỉ** (1 lượng = 10 chỉ = 37.5 g),
with a history chart and a personal "my gold" ledger showing profit/loss at today's sell-back price.

```
Cloud Scheduler ──(09:15 & 15:15 ICT)──▶ Cloud Function recordGoldPrice ──▶ sjc.com.vn
                                               │
                                               ▼
                                    Firestore prices/{YYYY-MM-DD}
                                               ▲
Web app (Firebase Hosting, Google sign-in) ────┘   + users/{uid}/holdings/*
```

## Data model

`prices/2026-11-01`
```js
{ date, source: 'sjc.com.vn', sourceUpdatedAt, updatedAt,
  bar:  { name, buyPerLuong, sellPerLuong, buyPerChi, sellPerChi, highSellPerChi, lowSellPerChi },
  ring: { ...same } }
```
`buy` = what the shop pays you. `sell` = what you pay the shop.

`users/{uid}/holdings/{id}` → `{ type: 'bar'|'ring', chi, pricePerChi, boughtOn: 'YYYY-MM-DD', createdAt }`

## Setup

1. Create a Firebase project. **Upgrade it to the Blaze plan.** Scheduled functions need it.
   At 2 runs/day you'll stay inside the free quota, but a billing account is still required.
2. Enable **Authentication → Google** and create a **Firestore** database (region `asia-southeast1`).
3. Put your project ID in `.firebaserc`.
4. Register a Web app in the console, then `cp web/.env.example web/.env.local` and fill it in.
5. Deploy:
   ```bash
   npm i -g firebase-tools && firebase login
   npm --prefix functions install && npm --prefix web install
   firebase deploy        # functions + rules + hosting
   ```
6. Seed the first day right away instead of waiting for the schedule:
   Cloud Console → Cloud Scheduler → `firebase-schedule-recordGoldPrice-...` → **Force run**.

## Development

```bash
npm --prefix functions test          # parser unit tests
npm --prefix functions run fetch:once  # hit SJC live and print parsed prices
npm --prefix web run dev
```

## Known risks

- **The SJC endpoint is unofficial.** `PriceService.ashx` is what sjc.com.vn's own page calls. It has no API contract
  and can change without notice. The parser fails loudly (no row / implausible value / buy > sell) instead of writing
  bad data, and the function retries 3×. Check Cloud Functions logs if a day goes missing.
- SJC may block or rate-limit Google Cloud IPs. If `fetch:once` works locally but the function fails, that's the likely cause.
- Prices are for the Hồ Chí Minh branch. Change the `branch` argument in `parseSjc` if you prefer Hà Nội.
