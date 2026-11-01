import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection, query, orderBy, limit, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { auth, provider, db } from './firebase.js';

const $ = (s) => document.querySelector(s);
const vnd = (n) => (n == null ? '—' : n.toLocaleString('vi-VN') + ' đ');
const LABEL = { bar: 'SJC bar', ring: 'SJC 9999 ring' };

let prices = [];   // newest first
let holdings = [];
let unsub = [];

$('#login').onclick = () => signInWithPopup(auth, provider).catch((e) => alert(e.message));

onAuthStateChanged(auth, (user) => {
  unsub.forEach((f) => f()); unsub = [];
  $('#signed-out').hidden = !!user;
  $('#app').hidden = !user;
  $('#user').innerHTML = '';
  if (!user) return;

  const out = Object.assign(document.createElement('button'), { textContent: 'Sign out', onclick: () => signOut(auth) });
  $('#user').append(user.displayName ?? user.email, ' ', out);

  unsub.push(onSnapshot(query(collection(db, 'prices'), orderBy('date', 'desc'), limit(365)), (snap) => {
    prices = snap.docs.map((d) => d.data());
    renderToday(); renderHistory(); renderHoldings();
  }, (e) => console.error(e)));

  unsub.push(onSnapshot(query(collection(db, 'users', user.uid, 'holdings'), orderBy('boughtOn', 'desc')), (snap) => {
    holdings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHoldings();
  }, (e) => console.error(e)));
});

function renderToday() {
  const [t, y] = prices;
  if (!t) { $('#today').innerHTML = '<p>No prices recorded yet. The function runs at 09:15 and 15:15 Vietnam time.</p>'; return; }
  $('#today').innerHTML = ['bar', 'ring'].map((k) => {
    const d = y ? t[k].sellPerChi - y[k].sellPerChi : null;
    const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
    return `<div class="card">
      <h3>${LABEL[k]}</h3>
      <div class="big">${vnd(t[k].sellPerChi)}</div>
      <div>Shop buys: ${vnd(t[k].buyPerChi)}</div>
      <div>Spread: ${vnd(t[k].sellPerChi - t[k].buyPerChi)}</div>
      ${d != null ? `<div class="${cls}">${d >= 0 ? '+' : ''}${vnd(d)} vs ${y.date}</div>` : ''}
    </div>`;
  }).join('') + `<p class="note">As of ${t.date}${t.sourceUpdatedAt ? ` (SJC updated ${t.sourceUpdatedAt})` : ''}</p>`;
}

function renderHistory() {
  const type = $('#type').value;
  const rows = prices.slice(0, Number($('#range').value)).filter((p) => p[type]);
  $('#history tbody').innerHTML = rows.map((p, i) => {
    const prev = rows[i + 1];
    const d = prev ? p[type].sellPerChi - prev[type].sellPerChi : null;
    return `<tr><td>${p.date}</td><td>${vnd(p[type].sellPerChi)}</td><td>${vnd(p[type].buyPerChi)}</td>
      <td class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '' : (d >= 0 ? '+' : '') + d.toLocaleString('vi-VN')}</td></tr>`;
  }).join('');
  drawChart(rows.slice().reverse().map((p) => [p[type].sellPerChi, p[type].buyPerChi]));
}

function drawChart(series) {
  const svg = $('#chart');
  if (series.length < 2) { svg.innerHTML = '<text x="10" y="110">Need at least 2 days of data</text>'; return; }
  const all = series.flat(); const min = Math.min(...all); const max = Math.max(...all);
  const W = 600, H = 220, pad = 10;
  const x = (i) => pad + (i * (W - 2 * pad)) / (series.length - 1);
  const yy = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  const line = (j) => series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yy(s[j]).toFixed(1)}`).join('');
  svg.innerHTML = `<path d="${line(0)}" class="sell"/><path d="${line(1)}" class="buy"/>
    <text x="${W - pad}" y="16" text-anchor="end">${vnd(max)}</text>
    <text x="${W - pad}" y="${H - 14}" text-anchor="end">${vnd(min)}</text>`;
}

function renderHoldings() {
  const t = prices[0];
  let totalPaid = 0, totalNow = 0;
  $('#holdings tbody').innerHTML = holdings.map((h) => {
    const now = t?.[h.type] ? h.chi * t[h.type].buyPerChi : null;
    const paid = h.chi * h.pricePerChi;
    totalPaid += paid; if (now != null) totalNow += now;
    const pl = now == null ? null : now - paid;
    return `<tr><td>${h.boughtOn}</td><td>${LABEL[h.type]}</td><td>${h.chi}</td><td>${vnd(h.pricePerChi)}</td>
      <td>${vnd(now)}</td><td class="${pl > 0 ? 'up' : pl < 0 ? 'down' : ''}">${vnd(pl)}</td>
      <td><button data-del="${h.id}" aria-label="Delete">✕</button></td></tr>`;
  }).join('') + (holdings.length ? `<tr class="total"><td colspan="4">Total paid ${vnd(totalPaid)}</td><td>${vnd(totalNow)}</td>
      <td class="${totalNow - totalPaid >= 0 ? 'up' : 'down'}">${vnd(totalNow - totalPaid)}</td><td></td></tr>` : '');
}

$('#holdings').onclick = (e) => {
  const id = e.target.dataset?.del;
  if (id && confirm('Delete this entry?')) deleteDoc(doc(db, 'users', auth.currentUser.uid, 'holdings', id));
};

$('#holding-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  await addDoc(collection(db, 'users', auth.currentUser.uid, 'holdings'), {
    type: f.get('type'),
    chi: Number(f.get('chi')),
    pricePerChi: Number(f.get('pricePerChi')),
    boughtOn: f.get('boughtOn'),
    createdAt: serverTimestamp(),
  }).catch((err) => alert(err.message));
  e.target.reset();
};

$('#type').onchange = renderHistory;
$('#range').onchange = renderHistory;
