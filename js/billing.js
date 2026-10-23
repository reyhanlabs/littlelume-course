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

// Setiap perubahan absensi / pembayaran / deposit / murid → sinkronkan pelunasan otomatis
(function(){
  if(typeof DB==='undefined' || DB._billHooked) return;
  const orig = DB.set;
  DB.set = function(k, v){
    orig(k, v);
    if(['absensi','bayar','deposits','siswa'].includes(k)){
      try{ if(billSyncDeposits()) orig('bayar', bayarList); }catch(e){ console.warn('billSyncDeposits', e); }
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
