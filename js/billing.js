// ════════════════════════════════════════════════════════════════════
//  BILLING PER SESI (v1.15)
// ────────────────────────────────────────────────────────────────────
//  Aturan tunggal: yang ditagih hanya sesi berstatus Present (Hadir),
//  sebesar tarif per sesi murid itu. "Bayar per sesi" atau "bayar di muka"
//  hanya cara membayar, bukan cara menghitung.
//
//  • Bayar lebih dari tagihan  → kelebihannya otomatis jadi saldo deposit.
//  • Bayar tanpa memilih sesi  → seluruhnya jadi saldo deposit (bayar di muka).
//  • Saldo deposit otomatis melunasi sesi Present yang belum dibayar
//    (urut tanggal) lewat pembayaran "auto" — satu record per murid per bulan,
//    id tetap (auto_<siswa>_<YYYY-MM>) supaya aman disinkron antar-perangkat.
//  • Sisa saldo yang belum cukup untuk 1 sesi tetap tersimpan → bulan berikutnya.
//
//  Data lama "Monthly (flat)" dikonversi lewat billMigrateOpen() (ada pratinjau).
// ════════════════════════════════════════════════════════════════════

const BILL_AUTO_PREFIX = 'auto_';

function billFee(s){
  if(!s) return 0;
  return +s.feePerSesi || 0;
}
function billIsLegacy(s){ return s && s.billingType==='monthly'; }
function billHasLegacy(){
  return siswaList.some(billIsLegacy) || bayarList.some(b=>b.billingType==='monthly' && !b.converted);
}
function _billYM(t){ return String(t||'').slice(0,7); }
function billMonthLabel(ym){
  const [y,m] = String(ym).split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString('en-GB',{month:'long', year:'numeric'});
}
// "September 2026", "September - October 2026", "December 2026 - January 2027"
function billPeriodLabel(dates){
  const yms = [...new Set((dates||[]).filter(Boolean).map(_billYM))].sort();
  if(!yms.length) return '';
  if(yms.length===1) return billMonthLabel(yms[0]);
  const a = yms[0], b = yms[yms.length-1];
  const ma = new Date(+a.slice(0,4), +a.slice(5)-1, 1).toLocaleDateString('en-GB',{month:'long'});
  return a.slice(0,4)===b.slice(0,4) ? `${ma} - ${billMonthLabel(b)}` : `${billMonthLabel(a)} - ${billMonthLabel(b)}`;
}
// Sesi yang sudah terhubung ke pembayaran (opsional: hanya pembayaran manual)
function billPaidSessionIds(manualOnly){
  const set = new Set();
  bayarList.forEach(b=>{ if(manualOnly && b.auto) return; (b.sesiIds||[]).forEach(id=>set.add(id)); });
  return set;
}
// Ringkasan tagihan satu murid
function billSummary(s){
  const fee = billFee(s);
  const paid = billPaidSessionIds();
  const present = absensiList.filter(a=>a.siswaId===s.id && a.status==='Hadir').sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const unpaid = present.filter(a=>!paid.has(a.id));
  const depBal = typeof getDepositBalance==='function' ? getDepositBalance(s.id) : 0;
  return { fee, present, unpaid, unpaidAmount: unpaid.length*fee, depBal, net: Math.max(0, unpaid.length*fee - depBal) };
}

// ── Pelunasan otomatis dari saldo deposit ─────────────────────────────
// Bangun ulang semua pembayaran "auto" dari nol (deterministik & idempoten).
// Return true kalau bayarList berubah.
function billSyncDeposits(onlySiswaId){
  if(!Array.isArray(bayarList) || !Array.isArray(siswaList)) return false;
  const targets = onlySiswaId ? siswaList.filter(s=>s.id===onlySiswaId) : siswaList;
  const targetIds = new Set(targets.map(s=>s.id));
  const before = bayarList.filter(b=>b.auto && targetIds.has(b.siswaId));
  const manualPaid = billPaidSessionIds(true);
  const fresh = [];
  targets.forEach(s=>{
    if(billIsLegacy(s)) return;                       // tunggu konversi dulu
    const fee = billFee(s); if(!(fee>0)) return;
    const topups  = depositList.filter(d=>d.siswaId===s.id && d.tipe==='topup').reduce((t,d)=>t+(+d.jumlah||0),0);
    const refunds = depositList.filter(d=>d.siswaId===s.id && d.tipe==='refund').reduce((t,d)=>t+(+d.jumlah||0),0);
    const usedManual = bayarList.filter(b=>b.siswaId===s.id && !b.auto).reduce((t,b)=>t+(+b.depositUsed||0),0);
    let bal = topups - refunds - usedManual;
    if(bal < fee) return;
    const unpaid = absensiList.filter(a=>a.siswaId===s.id && a.status==='Hadir' && !manualPaid.has(a.id))
                              .sort((a,b)=>a.tanggal.localeCompare(b.tanggal) || String(a.id).localeCompare(String(b.id)));
    const byMonth = {};
    for(const a of unpaid){
      if(bal < fee) break;
      bal -= fee;
      (byMonth[_billYM(a.tanggal)] = byMonth[_billYM(a.tanggal)] || []).push(a);
    }
    Object.entries(byMonth).forEach(([ym, list])=>{
      const amt = list.length*fee;
      fresh.push({
        id: BILL_AUTO_PREFIX + s.id + '_' + ym,
        siswaId: s.id, namaSiswa: s.nama,
        periode: billMonthLabel(ym),
        tanggal: list[list.length-1].tanggal,
        sesiIds: list.map(a=>a.id),
        tagihan: amt, jumlah: amt, depositUsed: amt,
        status: 'Lunas', billingType: 'per_session', auto: true,
        catatan: 'Paid automatically from deposit',
      });
    });
  });
  const sig = arr => JSON.stringify(arr.map(b=>[b.id,b.tanggal,b.periode,b.sesiIds,b.tagihan,b.jumlah,b.depositUsed,b.namaSiswa]).sort());
  if(sig(before) === sig(fresh)) return false;
  bayarList = bayarList.filter(b=>!(b.auto && targetIds.has(b.siswaId))).concat(fresh);
  return true;
}

// Peta sesi yang dibayar otomatis: sesiId → { siswaId, amount }
function _billAutoMap(){
  const m = new Map();
  bayarList.forEach(b=>{ if(!b.auto) return; const per = (b.sesiIds||[]).length ? Math.round((+b.tagihan||0)/b.sesiIds.length) : 0;
    (b.sesiIds||[]).forEach(id=>m.set(id, { siswaId:b.siswaId, amount:per })); });
  return m;
}
// Notifikasi (lonceng + toast) saat deposit memotong / mengembalikan pembayaran sesi
function _billNotifyChanges(before, after){
  const per = {};
  const get = id => per[id] || (per[id] = { added:[], removed:[] });
  after.forEach((v, id)=>{ if(!before.has(id)) get(v.siswaId).added.push({ id, amount:v.amount }); });
  before.forEach((v, id)=>{ if(!after.has(id)) get(v.siswaId).removed.push({ id, amount:v.amount }); });
  const dateOf = id => { const a = absensiList.find(x=>x.id===id); return a ? new Date(a.tanggal+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : ''; };
  const cls = (typeof currentClassName!=='undefined' && currentClassName) ? ' · '+currentClassName : '';
  const toasts = [];
  Object.entries(per).forEach(([sid, ch])=>{
    const s = siswaList.find(x=>x.id===sid); if(!s) return;
    const name = s.nick || s.nama;
    const bal = typeof getDepositBalance==='function' ? getDepositBalance(sid) : 0;
    const fee = billFee(s);
    if(ch.added.length){
      const amt = ch.added.reduce((t,x)=>t+x.amount,0);
      const dates = ch.added.map(x=>dateOf(x.id)).filter(Boolean).join(', ');
      if(typeof addNotif==='function') addNotif(`${s.nama}: ${ch.added.length} session(s) paid from deposit`,
        `${fmt(amt)}${dates?' ('+dates+')':''} · balance left ${fmt(bal)}${cls}`, '🏦', 'payment');
      toasts.push(`🏦 ${esc(name)}: ${ch.added.length} session(s) paid from deposit (${fmt(amt)}) · balance ${fmt(bal)}`);
      if(fee>0 && bal < fee && typeof addNotif==='function')
        addNotif(bal>0 ? `${s.nama}: deposit almost empty` : `${s.nama}: deposit used up`, bal>0 ? `${fmt(bal)} left — not enough for the next session (${fmt(fee)})${cls}` : `Next sessions will be billed normally (${fmt(fee)} each)${cls}`, '⚠️', 'deposits');
    }
    if(ch.removed.length){
      const amt = ch.removed.reduce((t,x)=>t+x.amount,0);
      const dates = ch.removed.map(x=>dateOf(x.id)).filter(Boolean).join(', ');
      if(typeof addNotif==='function') addNotif(`${s.nama}: ${fmt(amt)} returned to deposit`,
        `${ch.removed.length} session(s)${dates?' ('+dates+')':''} no longer billed · balance ${fmt(bal)}${cls}`, '↩️', 'deposits');
      toasts.push(`↩️ ${esc(name)}: ${fmt(amt)} returned to deposit · balance ${fmt(bal)}`);
    }
  });
  if(toasts.length && typeof showToast==='function')
    setTimeout(()=>showToast(toasts.slice(0,3).join('<br>') + (toasts.length>3?`<br>+${toasts.length-3} more — see 🔔`:''), 'info', 6000), 450);
}

// Setiap perubahan absensi / pembayaran / deposit / murid → sinkronkan pelunasan otomatis
(function(){
  if(typeof DB==='undefined' || DB._billHooked) return;
  const orig = DB.set;
  DB.set = function(k, v){
    orig(k, v);
    if(['absensi','bayar','deposits','siswa'].includes(k)){
      try{
        const before = _billAutoMap();
        if(billSyncDeposits()){ orig('bayar', bayarList); _billNotifyChanges(before, _billAutoMap()); }
      }catch(e){ console.warn('billSyncDeposits', e); }
    }
  };
  DB._billHooked = true;
})();

// ════════════════════════════════════════════════════════════════════
//  KONVERSI DATA LAMA "MONTHLY (FLAT)" → PER SESI
// ════════════════════════════════════════════════════════════════════
let _billMig = null;   // { rows:[{s, fee, ...}], plan }

function _billMigFeeDefault(s){
  if(+s.feePerSesi>0) return +s.feePerSesi;
  if(+s.feeMonthly>0) return Math.round(s.feeMonthly/4/1000)*1000 || Math.round(s.feeMonthly/4);
  return 0;
}
// Rencana konversi untuk satu murid (tidak mengubah data)
function _billMigPlanStudent(s, fee){
  const pays = bayarList.filter(b=>b.siswaId===s.id && b.billingType==='monthly' && !b.converted);
  const otherPaid = new Set();
  bayarList.filter(b=>b.siswaId===s.id && !(b.billingType==='monthly' && !b.converted) && !b.auto)
           .forEach(b=>(b.sesiIds||[]).forEach(id=>otherPaid.add(id)));
  // Kelompokkan per periode (cicilan periode yang sama = satu grup)
  const groups = {};
  pays.forEach(b=>{
    const months = (typeof parsePeriodeToMonths==='function' ? parsePeriodeToMonths(b.periode||'') : []);
    const key = months.join(',') || ('raw:'+b.id);
    (groups[key] = groups[key] || { months, pays:[] }).pays.push(b);
  });
  const updates = [], removes = [], topups = [];
  let sessCovered = 0, applied = 0, toDeposit = 0;
  const usedSess = new Set();
  Object.values(groups).forEach(g=>{
    g.pays.sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'') || String(a.id).localeCompare(String(b.id)));
    const set = new Set(g.months);
    const sessions = absensiList.filter(a=>a.siswaId===s.id && a.status==='Hadir' && set.has(_billYM(a.tanggal)) && !otherPaid.has(a.id) && !usedSess.has(a.id))
                                .sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
    const lunas = g.pays.some(b=>b.status==='Lunas');
    let idx = 0;
    g.pays.forEach((b, i)=>{
      const v = +b.jumlah||0, dep = +b.depositUsed||0;
      const isLast = i===g.pays.length-1;
      let k = fee>0 ? Math.min(sessions.length-idx, Math.floor(v/fee)) : 0;
      let newJ = k*fee;
      // Periode lama yang sudah Lunas: sesi yang tersisa ikut dianggap lunas (tidak membuat utang baru)
      let settled = false;
      if(isLast && lunas && idx+k < sessions.length){ k = sessions.length-idx; newJ = v; settled = true; }
      const sess = sessions.slice(idx, idx+k); idx += k;
      sess.forEach(a=>usedSess.add(a.id));
      const newDep = Math.min(dep, newJ);
      const cashExcess = (v - dep) - (newJ - newDep);
      sessCovered += k; applied += newJ;
      if(cashExcess>0){ toDeposit += cashExcess; topups.push({ from:b, amount:cashExcess }); }
      if(k===0 && newJ===0) removes.push(b);
      else updates.push({ b, sesiIds: sess.map(a=>a.id), jumlah:newJ, tagihan: settled ? newJ : Math.max(newJ, k*fee), depositUsed:newDep });
    });
  });
  const allPresent = absensiList.filter(a=>a.siswaId===s.id && a.status==='Hadir');
  const paidAfter = new Set([...otherPaid, ...usedSess]);
  const owedRaw = allPresent.filter(a=>!paidAfter.has(a.id)).length;
  // Saldo deposit (lama + kelebihan konversi) langsung melunasi sesi yang belum dibayar
  const balNow = (typeof getDepositBalance==='function' ? getDepositBalance(s.id) : 0);
  const byDeposit = fee>0 ? Math.min(owedRaw, Math.floor((balNow + toDeposit)/fee)) : 0;
  const stillOwed = owedRaw - byDeposit;
  return { s, fee, pays, updates, removes, topups, sessCovered, applied, toDeposit, stillOwed, byDeposit,
           paidTotal: pays.reduce((t,b)=>t+(+b.jumlah||0),0) };
}
function _billMigStudents(){
  const ids = new Set([...siswaList.filter(billIsLegacy).map(s=>s.id), ...bayarList.filter(b=>b.billingType==='monthly' && !b.converted).map(b=>b.siswaId)]);
  return siswaList.filter(s=>ids.has(s.id));
}

function billMigrateOpen(){
  const students = _billMigStudents();
  if(!students.length){ showToast('Nothing to convert — all students already use per-session billing.','success'); return; }
  _billMig = { fees: Object.fromEntries(students.map(s=>[s.id, _billMigFeeDefault(s)])) };
  let ov = document.getElementById('bill-mig');
  if(!ov){
    ov = document.createElement('div'); ov.id='bill-mig'; ov.className='pr-viewer';
    ov.innerHTML = `<div class="pr-viewer-box bm-box">
      <div class="pr-viewer-hd"><b>🔄 Switch to per-session billing</b><button class="btn sm icon-only" onclick="billMigrateClose()">✕</button></div>
      <div class="bm-body" id="bill-mig-body"></div>
      <div class="pr-viewer-ft">
        <button class="btn primary" id="bill-mig-go" onclick="billMigrateApply()">✅ Convert now</button>
        <button class="btn" onclick="billMigrateClose()">Later</button>
        <span class="pr-hint" style="align-self:center">A restore point is created first, so you can undo this in Backup &amp; Restore.</span>
      </div></div>`;
    ov.addEventListener('click', e=>{ if(e.target===ov) billMigrateClose(); });
    document.body.appendChild(ov);
  }
  _billMigRender();
  ov.classList.add('open');
}
function billMigrateClose(){ document.getElementById('bill-mig')?.classList.remove('open'); }
function billMigSetFee(id, el){ _billMig.fees[id] = Math.max(0, +String(el.value).replace(/\D/g,'')||0); _billMigRender(id); }

function _billMigRender(focusId){
  const students = _billMigStudents();
  const plans = students.map(s=>_billMigPlanStudent(s, _billMig.fees[s.id]||0));
  _billMig.plans = plans;
  const missing = plans.filter(p=>!(p.fee>0)).length;
  const body = document.getElementById('bill-mig-body');
  body.innerHTML = `
    <div class="bm-intro">
      <p>From now on <b>every student is billed per session they attend</b>. Monthly (flat) payments already recorded will be linked to the sessions attended in that month:</p>
      <ul>
        <li>Paid more than the sessions attended → the difference becomes <b>deposit balance</b> and pays the next sessions automatically.</li>
        <li>Months already marked <b>Paid</b> stay paid — no new debt is created for the past.</li>
        <li>Partial payments cover as many sessions as the money allows; the rest shows as unpaid.</li>
      </ul>
      <p>Check the <b>fee per session</b> for each student (suggested: monthly fee ÷ 4).</p>
    </div>
    <div class="tbl-wrap"><table class="bm-table">
      <thead><tr><th>Student</th><th>Fee / session</th><th class="r">Monthly paid</th><th class="r">Sessions covered</th><th class="r">→ Deposit</th><th class="r">Still unpaid</th></tr></thead>
      <tbody>${plans.map(p=>`<tr>
        <td><b>${esc(p.s.nama)}</b><div class="pr-hint">${p.pays.length} monthly payment(s)${+p.s.feeMonthly?` · was ${fmt(p.s.feeMonthly)}/month`:''}</div></td>
        <td><input type="text" inputmode="numeric" class="bm-fee" value="${p.fee?('Rp '+p.fee.toLocaleString('id-ID')):''}" placeholder="Rp 0" onchange="billMigSetFee('${p.s.id}',this)" data-id="${p.s.id}"></td>
        <td class="r">${fmt(p.paidTotal)}</td>
        <td class="r">${p.sessCovered}</td>
        <td class="r" style="color:var(--green);font-weight:800">${p.toDeposit?fmt(p.toDeposit):'—'}${p.byDeposit?`<div class="pr-hint">pays ${p.byDeposit} more session(s)</div>`:''}</td>
        <td class="r" style="color:${p.stillOwed?'var(--red)':'var(--muted)'};font-weight:800">${p.stillOwed?`${p.stillOwed} × ${fmt(p.fee)}`:'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${missing?`<div class="bm-warn">⚠️ ${missing} student(s) have no fee per session yet — fill it in to continue.</div>`:''}`;
  const go = document.getElementById('bill-mig-go'); if(go) go.disabled = !!missing;
  if(focusId){ const el = body.querySelector(`.bm-fee[data-id="${focusId}"]`); if(el) el.focus(); }
}

async function billMigrateApply(){
  const plans = _billMig?.plans || [];
  if(!plans.length || plans.some(p=>!(p.fee>0))) return;
  const btn = document.getElementById('bill-mig-go'); if(btn){ btn.disabled = true; btn.textContent='⏳ Converting…'; }
  // Restore point dulu (bisa dibatalkan dari Backup & Restore)
  try{
    if(typeof _rpWrite==='function' && typeof currentClassId!=='undefined' && currentClassId)
      await _rpWrite(currentClassId, 'm'+Date.now(), 'manual', _clone(_currentData()), 'Before per-session billing');
  }catch(e){ console.warn('restore point', e); }
  const today = todayISO();
  plans.forEach(p=>{
    const s = siswaList.find(x=>x.id===p.s.id); if(!s) return;
    p.updates.forEach(u=>{
      const b = bayarList.find(x=>x.id===u.b.id); if(!b) return;
      Object.assign(b, { sesiIds:u.sesiIds, jumlah:u.jumlah, tagihan:u.tagihan, depositUsed:u.depositUsed,
        status: derivePaymentStatus(u.jumlah, u.tagihan), billingType:'per_session', converted:true,
        catatan: [b.catatan, 'converted from monthly'].filter(Boolean).join(' · ') });
    });
    const rm = new Set(p.removes.map(b=>b.id));
    p.topups.forEach(t=>{
      depositList.push({ id: uid(), siswaId:s.id, namaSiswa:s.nama, tanggal: t.from.tanggal || today, jumlah: t.amount, tipe:'topup',
        metode: 'From payment', catatan: `Extra from monthly payment ${t.from.periode||''}`.trim(), fromBayarId: rm.has(t.from.id) ? null : t.from.id });
    });
    bayarList = bayarList.filter(b=>!rm.has(b.id));
    s.feePerSesi = p.fee; s.billingType = 'per_session';
  });
  DB.set('deposits', depositList);
  DB.set('siswa', siswaList);
  DB.set('bayar', bayarList);
  billMigrateClose();
  if(typeof renderAll==='function') renderAll();
  const dep = plans.reduce((t,p)=>t+p.toDeposit,0);
  successModal('✅ Switched to per-session billing',
    `${plans.length} student(s) converted.${dep?`<br><br><b>${fmt(dep)}</b> of extra monthly payments is now deposit balance and pays the next sessions automatically.`:''}`);
}

// Banner di halaman Payment bila masih ada data bulanan lama
function billRenderBanner(){
  const el = document.getElementById('bill-legacy-banner'); if(!el) return;
  if(!billHasLegacy()){ el.style.display='none'; el.innerHTML=''; return; }
  const n = _billMigStudents().length;
  el.style.display='flex';
  el.innerHTML = `<div><b>🔄 ${n} student(s) still use the old monthly (flat) billing.</b>
    <span>Switch them to per-session billing so the amount always matches the sessions attended.</span></div>
    <button class="btn primary sm" onclick="billMigrateOpen()">Review &amp; convert</button>`;
}

// Saat data kelas dimuat / diperbarui → pastikan pelunasan otomatis up to date
window.addEventListener('load', ()=>{
  if(typeof renderAll!=='function' || renderAll._bill) return;
  const orig = renderAll;
  renderAll = function(){
    try{ if(typeof _loadOk==='undefined' || _loadOk){ if(billSyncDeposits()) DB.set('bayar', bayarList); } }catch(e){ console.warn(e); }
    return orig.apply(this, arguments);
  };
  renderAll._bill = true;
});

// ════════════════════════════════════════════════════════════════════
//  TAGIHAN (Bill) — ringkasan untuk orang tua
//  Periode bebas (From – To, bisa lintas bulan) + mode:
//    • Unpaid only  → hanya sesi hadir yang belum dibayar
//    • All sessions → semua absensi (Present/Excused/Absent) + yang sudah dibayar
//  Memakai modal-receipt (receiptType='statement',
//  receiptId='<siswaId>|<from>|<to>|<u|a>') sehingga tombol WhatsApp /
//  Print / Image / Copy yang sama ikut berfungsi.
// ════════════════════════════════════════════════════════════════════
let _billSt = null;   // {siswaId, from, to, unpaidOnly}

function _billPaidMap(siswaId){
  const m = new Map();   // sesiId → 'cash' | 'deposit'
  bayarList.filter(b=>b.siswaId===siswaId).forEach(b=>(b.sesiIds||[]).forEach(id=>{
    if(!m.has(id) || b.auto) m.set(id, b.auto ? 'deposit' : 'cash');
  }));
  return m;
}
function _billMonthEnd(ym){ const [y,m]=ym.split('-').map(Number); return todayISO(new Date(y, m, 0)); }
// Periode default: dari sesi unpaid tertua (atau awal bulan ini) s/d akhir bulan ini
function _billDefaultRange(siswaId){
  const ym = todayISO().slice(0,7), pm = _billPaidMap(siswaId);
  const oldest = absensiList.filter(a=>a.siswaId===siswaId && a.status==='Hadir' && !pm.has(a.id))
    .map(a=>a.tanggal).sort()[0];
  const start = ym + '-01';
  return { from: oldest && oldest < start ? oldest : start, to: _billMonthEnd(ym) };
}

function billStatementData(siswaId, from, to, unpaidOnly){
  const s = siswaList.find(x=>x.id===siswaId); if(!s) return null;
  const fee = billFee(s), pm = _billPaidMap(siswaId);
  const all = absensiList.filter(a=>a.siswaId===siswaId).sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const inRange = all.filter(a=>a.tanggal>=from && a.tanggal<=to);
  const present = inRange.filter(a=>a.status==='Hadir');
  const excused = inRange.filter(a=>a.status==='Izin');
  const absent  = inRange.filter(a=>a.status==='Alpha');
  const paidCash = present.filter(a=>pm.get(a.id)==='cash');
  const paidDep  = present.filter(a=>pm.get(a.id)==='deposit');
  const unpaid   = present.filter(a=>!pm.has(a.id));
  const unpaidOutside = all.filter(a=>a.status==='Hadir' && !pm.has(a.id) && (a.tanggal<from || a.tanggal>to));
  const shown = unpaidOnly ? unpaid : inRange;
  const depBal = typeof getDepositBalance==='function' ? getDepositBalance(siswaId) : 0;
  const owed = unpaid.length * fee;
  const depApplied = Math.min(depBal, owed);
  const due = Math.max(0, owed - depApplied);
  return { s, from, to, unpaidOnly: !!unpaidOnly, fee, paidMap: pm, inRange, shown, present, excused, absent,
           paidCash, paidDep, unpaid, unpaidOutside, depBal, depApplied, owed, due, depLeft: depBal - depApplied };
}

// "November 2026" bila tepat satu bulan penuh, selain itu "2 Oct – 10 Nov 2026"
function billRangeLabel(from, to){
  const ym = from.slice(0,7);
  if(from === ym+'-01' && to === _billMonthEnd(ym)) return billMonthLabel(ym);
  return _billDay(from, from.slice(0,4)!==to.slice(0,4)) + ' – ' + _billDay(to, true);
}
const _BILL_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function _billDay(t, withYear){ return (+t.slice(8,10)) + ' ' + _BILL_MON[+t.slice(5,7)-1] + (withYear ? ' ' + t.slice(0,4) : ''); }
// Kelompokkan tanggal per bulan → [{ym, label:'Nov 2026', days:'2, 10'}]
function _billByMonth(list){
  const g = {};
  list.forEach(a=>{ const ym=_billYM(a.tanggal); (g[ym]=g[ym]||[]).push(+a.tanggal.slice(8,10)); });
  return Object.keys(g).sort().map(ym=>({ ym, label: _BILL_MON[+ym.slice(5,7)-1] + ' ' + ym.slice(0,4), days: g[ym].join(', ') }));
}

function _billStatementHTML(d){
  const s = d.s, periodLbl = billRangeLabel(d.from, d.to);
  const rno = 'BILL-' + d.to.slice(0,7).replace('-','') + '-' + s.id.slice(-4).toUpperCase();
  const initials = (s.nama||'?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const pill = (txt, bg, bd, col) => `<span style="display:inline-block;background:${bg};border:1px solid ${bd};color:${col};border-radius:999px;padding:3px 10px;font-size:0.68rem;font-weight:800;margin:0 4px 4px 0">${txt}</span>`;
  const stOf = a => a.status!=='Hadir'
      ? (a.status==='Izin' ? ['📝 Excused','#b45309','not billed'] : ['❌ Absent','#be123c','not billed'])
      : d.paidMap.get(a.id)==='cash' ? ['✅ Present','#0f766e','paid']
      : d.paidMap.get(a.id)==='deposit' ? ['✅ Present','#0f766e','paid · deposit']
      : ['✅ Present','#0f766e','<b style="color:#db2777">unpaid</b>'];
  const multiMonth = new Set(d.shown.map(a=>_billYM(a.tanggal))).size > 1;
  let lastYm = '';
  const rowsSess = d.shown.length ? d.shown.map(a=>{
      const [l,c,p]=stOf(a), ym=_billYM(a.tanggal);
      const hd = multiMonth && ym!==lastYm ? `<div style="font-size:0.62rem;font-weight:800;color:#0d9488;letter-spacing:.4px;padding:6px 0 2px">${billMonthLabel(ym).toUpperCase()}</div>` : '';
      lastYm = ym;
      return hd + `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed #f5d0e6;font-size:0.74rem">
        <span style="width:58px;font-weight:800;color:#4a1942">${_billDay(a.tanggal)}</span>
        <span style="flex:1;color:${c};font-weight:700">${l}</span>
        <span style="color:#7c6f86;font-size:0.68rem">${p}</span>
      </div>`; }).join('')
    : `<div style="font-size:0.74rem;color:#7c6f86;padding:6px 0">${d.unpaidOnly ? 'No unpaid sessions in this period. 🎉' : 'No attendance recorded in this period.'}</div>`;
  const line = (k, v, opt) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:0.76rem;${opt&&opt.b?'font-weight:800;':''}color:${opt&&opt.c||'#4a1942'}"><span>${k}</span><span style="white-space:nowrap">${v}</span></div>`;
  const plural = n => n>1?'s':'';
  const calc = d.unpaidOnly ? [
    line(`Unpaid sessions (${d.unpaid.length} × ${fmt(d.fee)})`, fmt(d.owed)),
    d.depApplied ? line('Deposit balance used', '− '+fmt(d.depApplied), {c:'#0f766e'}) : '',
  ].join('') : [
    line(`Sessions attended (${d.present.length} × ${fmt(d.fee)})`, fmt(d.present.length*d.fee)),
    d.paidCash.length ? line(`Already paid (${d.paidCash.length} session${plural(d.paidCash.length)})`, '− '+fmt(d.paidCash.length*d.fee), {c:'#0f766e'}) : '',
    d.paidDep.length  ? line(`Paid from deposit (${d.paidDep.length} session${plural(d.paidDep.length)})`, '− '+fmt(d.paidDep.length*d.fee), {c:'#0f766e'}) : '',
    d.depApplied ? line('Deposit balance used', '− '+fmt(d.depApplied), {c:'#0f766e'}) : '',
  ].join('');
  const pills = d.unpaidOnly
    ? pill(`⏳ ${d.unpaid.length} unpaid session${plural(d.unpaid.length)}`,'#fdf2f8','#f9a8d4','#be185d')
    : pill(`✅ ${d.present.length} Present`,'#e0fdf4','#5eead4','#0f766e')
      + (d.excused.length?pill(`📝 ${d.excused.length} Excused`,'#fffbeb','#fcd34d','#b45309'):'')
      + (d.absent.length?pill(`❌ ${d.absent.length} Absent`,'#fff1f2','#fda4af','#be123c'):'');
  const due = d.due > 0
    ? `<div style="background:linear-gradient(135deg,#db2777,#0d9488);border-radius:10px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;color:#fff">
         <span style="font-size:0.72rem;font-weight:800;letter-spacing:.4px">AMOUNT TO PAY</span><span style="font-size:1.05rem;font-weight:900">${fmt(d.due)}</span></div>`
    : `<div style="background:#e0fdf4;border:1px solid #5eead4;border-radius:10px;padding:11px 14px;text-align:center;color:#0f4c4c;font-size:0.8rem;font-weight:800">✅ ALL PAID — nothing to pay for this period</div>`;
  const depNote = d.depLeft > 0 ? `<div style="text-align:center;font-size:0.7rem;color:#0d9488;margin-top:7px">🏦 Deposit balance left: <b>${fmt(d.depLeft)}</b> — used for the next sessions</div>` : '';
  return `
  <div style="background:linear-gradient(135deg,#fdf2f8,#f0fdfa);padding:14px 16px;display:flex;align-items:center;gap:10px">
    <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#fff;box-shadow:0 1px 5px rgba(236,72,153,.28)"><img src="${APP_LOGO_URL}" crossorigin="anonymous" style="width:52px;height:52px;object-fit:contain;display:block"></div>
    <div style="flex:1;min-width:0">
      <div style="font-size:0.85rem;font-weight:800;line-height:1.2"><span style="color:#ec4899">Little</span><span style="color:#0d9488">Lume</span> <span style="color:#ec4899">English</span></div>
      <div style="color:#0d9488;font-size:0.62rem;margin-top:2px;font-weight:700">Bill · ${periodLbl}</div>
    </div>
    <div style="background:linear-gradient(135deg,#fce7f3,#d1fae5);border-radius:20px;padding:3px 9px;font-size:0.56rem;font-weight:800;color:#4a1942;font-family:monospace;white-space:nowrap;border:1px solid #f9a8d4">${rno}</div>
  </div>
  <div style="background:#fef9ff;padding:12px 14px">
    <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:linear-gradient(135deg,#fce7f3,#d1fae5);border-radius:10px;margin-bottom:10px;border:1px solid #f9a8d4">
      <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#ec4899,#0d9488);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:#fff;flex-shrink:0">${esc(initials)}</div>
      <div style="min-width:0"><div style="font-size:0.85rem;font-weight:800;color:#4a1942">${esc(s.nama)}</div>
        <div style="font-size:0.68rem;color:#0d9488;margin-top:1px">${s.namaOrtu?'Parent: '+esc(s.namaOrtu)+' · ':''}Fee ${fmt(d.fee)} / session</div></div>
    </div>
    <div style="font-size:0.62rem;color:#ec4899;font-weight:800;letter-spacing:.5px;margin-bottom:5px">${d.unpaidOnly?'UNPAID SESSIONS':'ATTENDANCE'} · ${periodLbl.toUpperCase()}</div>
    <div>${pills}</div>
    <div style="background:#fff;border:1px solid #f9a8d4;border-radius:10px;padding:4px 10px;margin:4px 0 10px">${rowsSess}</div>
    <div style="font-size:0.62rem;color:#ec4899;font-weight:800;letter-spacing:.5px;margin-bottom:3px">BILL</div>
    <div style="background:#fff;border:1px solid #f9a8d4;border-radius:10px;padding:6px 12px;margin-bottom:10px">${calc}</div>
    ${due}${depNote}
    <div style="font-size:0.64rem;color:#7c6f86;text-align:center;margin-top:8px">Only sessions attended (Present) are billed. Excused / absent sessions are free.</div>
  </div>
  <div style="background:linear-gradient(135deg,#fce7f3,#d1fae5);padding:10px 16px;text-align:center">
    <div style="font-size:0.62rem;font-weight:700"><span style="color:#ec4899">Little</span><span style="color:#0d9488">Lume</span> <span style="color:#ec4899">English</span></div>
    <div style="font-size:0.58rem;color:#7c6f86;margin-top:2px">Learn &bull; Play &bull; Shine</div>
  </div>`;
}
function _billStatementText(d){
  const s = d.s, nick = s.nick || s.nama.split(' ')[0], period = billRangeLabel(d.from, d.to);
  const L = [];
  L.push(`Assalamu’alaikum, Dear Parents 😊`, '');
  L.push(`Here is *${nick}*’s English class bill for *${period}*:`, '');
  if(d.unpaidOnly){
    L.push(`📅 Unpaid sessions: ${d.unpaid.length}`);
    _billByMonth(d.unpaid).forEach(m=>L.push(`   ${m.label}: ${m.days}`));
    L.push(`💳 Fee: ${d.unpaid.length} × ${fmt(d.fee)} = ${fmt(d.owed)}`);
  } else {
    L.push(`📅 Attendance: ${d.present.length} present${d.excused.length?`, ${d.excused.length} excused`:''}${d.absent.length?`, ${d.absent.length} absent`:''}`);
    _billByMonth(d.present).forEach(m=>L.push(`   ${m.label}: ${m.days}`));
    L.push(`💳 Fee: ${d.present.length} × ${fmt(d.fee)} = ${fmt(d.present.length*d.fee)}`);
    if(d.paidCash.length) L.push(`✅ Already paid: ${fmt(d.paidCash.length*d.fee)}`);
    if(d.paidDep.length)  L.push(`🏦 Paid from deposit: ${fmt(d.paidDep.length*d.fee)}`);
  }
  if(d.depApplied) L.push(`🏦 Deposit balance used: ${fmt(d.depApplied)}`);
  L.push('');
  L.push(d.due>0 ? `👉 *Amount to pay: ${fmt(d.due)}*` : `✅ *All paid — nothing to pay for this period.*`);
  if(d.depLeft>0) L.push(`Deposit balance left: ${fmt(d.depLeft)} (used for the next sessions)`);
  L.push('', 'Thank you for your trust and support 💗', '', 'Warm regards,', 'LittleLume English', 'Learn • Play • Shine ✨');
  return L.join('\n');
}

// Buka tagihan. siswaId kosong → murid pertama yang masih punya tunggakan.
// opts: {from, to, unpaidOnly} — yang tidak diisi pakai nilai sebelumnya / default.
function billStatementOpen(siswaId, opts){
  if(!siswaList.length){ showToast('Add students first.','warn'); return; }
  opts = opts || {};
  if(!siswaId){
    const pmAll = new Set(); bayarList.forEach(b=>(b.sesiIds||[]).forEach(id=>pmAll.add(id)));
    const owing = siswaList.find(s=>absensiList.some(a=>a.siswaId===s.id && a.status==='Hadir' && !pmAll.has(a.id)));
    siswaId = (owing || siswaList[0]).id;
  }
  const changedStudent = !_billSt || _billSt.siswaId !== siswaId;
  const def = _billDefaultRange(siswaId);
  let from = opts.from || (changedStudent || opts.reset ? def.from : _billSt.from);
  let to   = opts.to   || (changedStudent || opts.reset ? def.to   : _billSt.to);
  if(from > to){ const x = from; from = to; to = x; }
  const unpaidOnly = opts.unpaidOnly !== undefined ? !!opts.unpaidOnly : (_billSt ? _billSt.unpaidOnly : true);
  _billSt = { siswaId, from, to, unpaidOnly };
  const d = billStatementData(siswaId, from, to, unpaidOnly); if(!d) return;

  const ym = todayISO().slice(0,7);
  const outside = d.unpaidOutside.length
    ? `<div class="bill-st-note">⚠️ ${d.unpaidOutside.length} more unpaid session${d.unpaidOutside.length>1?'s':''} outside this period (${_billByMonth(d.unpaidOutside).map(m=>m.label+': '+m.days).join(' · ')}) — <a href="#" onclick="billStatementOpen('${siswaId}',{reset:true});return false">include all unpaid</a></div>` : '';
  const picker = `<div class="bill-st-picker">
      <select onchange="billStatementOpen(this.value)">${siswaList.map(x=>`<option value="${x.id}" ${x.id===siswaId?'selected':''}>${esc(x.nama)}</option>`).join('')}</select>
      <div class="bill-st-range">
        <label>From<input type="date" value="${from}" onchange="billStatementOpen('${siswaId}',{from:this.value})"></label>
        <label>To<input type="date" value="${to}" onchange="billStatementOpen('${siswaId}',{to:this.value})"></label>
      </div>
      <div class="bill-st-row">
        <div class="bill-st-seg">
          <button type="button" class="${unpaidOnly?'on':''}" onclick="billStatementOpen('${siswaId}',{unpaidOnly:true})">⏳ Unpaid only</button>
          <button type="button" class="${unpaidOnly?'':'on'}" onclick="billStatementOpen('${siswaId}',{unpaidOnly:false})">📋 All sessions</button>
        </div>
        <div class="bill-st-quick">
          <button type="button" onclick="billStatementOpen('${siswaId}',{from:'${ym}-01',to:'${_billMonthEnd(ym)}'})">This month</button>
          <button type="button" onclick="billStatementOpen('${siswaId}',{reset:true})">All unpaid</button>
        </div>
      </div>
      ${outside}
    </div>`;
  document.getElementById('receipt-content').innerHTML = picker + `<div>${_billStatementHTML(d)}</div>`;
  const modal = document.getElementById('modal-receipt');
  modal.dataset.receiptId = [siswaId, from, to, unpaidOnly?'u':'a'].join('|');
  modal.dataset.receiptType = 'statement';
  modal.dataset.receiptText = _billStatementText(d);
  const t = modal.querySelector('.modal-title'); if(t) t.textContent = '📄 Bill';
  const ws = document.getElementById('wa-status'); if(ws) ws.style.display='none';
  if(!modal.classList.contains('open')) openModal('modal-receipt');
}
function _billStatementContext(id){
  const [siswaId, from, to, mode] = String(id||'').split('|');
  const d = billStatementData(siswaId, from, to, mode !== 'a'); if(!d) return null;
  const html = _billStatementHTML(d), period = billRangeLabel(from, to);
  return {
    type:'statement', record:d, siswa:d.s,
    renderHTML: html,
    printHTML: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill ${esc(d.s.nama)} ${period}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;max-width:400px;margin:auto;background:#fef9ff;color:#4a1942;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A5 portrait;margin:8mm}</style>
      </head><body>${html}</body></html>`,
    filenameBase: 'Bill-' + (d.s.nama||'Student').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/ +/g,'_') + '-' + from + '_' + to,
    shareTextTitle: 'Bill for ' + d.s.nama,
    caption: _billStatementText(d),
    studentPhone: d.s.hp,
  };
}
