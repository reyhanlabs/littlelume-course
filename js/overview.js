// ════════════════════════════════════════════════
//  ALL CLASSES — ringkasan semua kelas dalam satu halaman
// ────────────────────────────────────────────────
//  Data kelas lain dibaca langsung dari Firestore (1 read per kelas, cache 60 detik).
//  Kelas yang sedang aktif selalu memakai data di memori (paling baru).
//  Perhitungan tagihan memakai fungsi yang sama dengan Dashboard/Payment
//  (computePaymentReminders, getDepositBalance, dll.) dengan cara menukar data
//  global sementara (_ovWith) — sinkron, tanpa render, lalu dikembalikan.
// ════════════════════════════════════════════════
let _ovCache = {};          // classId → { data, at }
let _ovLastResult = null;   // hasil hitung terakhir (dipakai tombol WA)
const OV_CACHE_MS = 60000;

async function _ovLoadClass(cls, force){
  if(cls.id === currentClassId && _loadOk) return _clone(_currentData());
  const c = _ovCache[cls.id];
  if(!force && c && Date.now() - c.at < OV_CACHE_MS) return c.data;
  const snap = await db.collection('workspace').doc(cls.id).get();
  const data = _dataFromDoc(snap.exists ? snap.data() : {});
  _ovCache[cls.id] = { data, at: Date.now() };
  return data;
}

// Jalankan fn dengan data kelas lain sebagai data "aktif", lalu kembalikan seperti semula
function _ovWith(data, fn){
  const saved = _currentData();
  _setLists(data);
  try{ return fn(); }
  finally{ _setLists(saved); }
}

function _ovCompute(cls, data, ym){
  return _ovWith(data, ()=>{
    const inMonth = t => (t||'').slice(0,7) === ym;
    const pays = bayarList.filter(b=>inMonth(b.tanggal) && b.status!=='Belum Bayar');
    const revenue  = pays.reduce((t,b)=>t+(+b.jumlah||0),0);
    const sessions = absensiList.filter(a=>inMonth(a.tanggal) && a.status==='Hadir').length;
    const reminders = computePaymentReminders().map(r=>({
      cls, siswa: r.siswa, total: r.total, gross: r.grossTotal, depBal: r.depBal,
      unpaidCount: r.unpaidCount, isMonthly: r.isMonthly, daysSince: r.daysSince||0,
      waText: buildPaymentReminderWA(r.siswa),
    }));
    const outstanding = reminders.reduce((t,r)=>t+(r.total||0),0);
    const depositHeld = siswaList.reduce((t,s)=>t+Math.max(0,getDepositBalance(s.id)),0);
    const schedule = scheduleList.map(sc=>{
      const s = siswaList.find(x=>x.id===sc.siswaId);
      return s ? { cls, nama: s.nick||s.nama, days: sc.days||[], jam: sc.jam||'', durasi: sc.durasi } : null;
    }).filter(Boolean);
    return { cls, students: siswaList.length, revenue, sessions, outstanding, depositHeld, reminders, schedule };
  });
}

async function renderOverview(force){
  const root = document.getElementById('ov-body'); if(!root) return;
  const monthEl = document.getElementById('ov-month');
  if(monthEl && !monthEl.value) monthEl.value = todayISO().slice(0,7);
  const ym = monthEl?.value || todayISO().slice(0,7);

  if(!classesList.length){ root.innerHTML = '<div class="card" style="color:var(--muted)">Loading classes…</div>'; return; }
  root.innerHTML = '<div class="card" style="color:var(--muted)">⏳ Loading all classes…</div>';

  const results = [], failed = [];
  await Promise.all(classesList.map(async cls=>{
    try{ results.push(_ovCompute(cls, await _ovLoadClass(cls, force), ym)); }
    catch(e){ console.error('overview load', cls.id, e); failed.push(cls); }
  }));
  results.sort((a,b)=>classesList.indexOf(a.cls)-classesList.indexOf(b.cls));
  _ovLastResult = results;
  root.innerHTML = _ovHTML(results, failed, ym);
}

function _ovMonthLabel(ym){
  const [y,m] = ym.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
}
function _ovDot(cls){
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(cls.color||'#6c63ff')};margin-right:6px;vertical-align:middle"></span>`;
}

function _ovHTML(results, failed, ym){
  const sum = k => results.reduce((t,r)=>t+r[k],0);
  const allRem = results.flatMap(r=>r.reminders).sort((a,b)=>b.total-a.total);
  const owing = allRem.filter(r=>r.total>0);

  const cards = `
    <div class="card-grid card-grid-4" style="margin-bottom:20px">
      <div class="stat-card s-purple"><div class="ico">👤</div><div class="val">${sum('students')}</div><div class="lbl">Students · ${results.length} classes</div></div>
      <div class="stat-card s-green"><div class="ico">💰</div><div class="val" style="font-size:1.2rem">${fmt(sum('revenue'))}</div><div class="lbl">Revenue · ${_ovMonthLabel(ym)}</div></div>
      <div class="stat-card s-red"><div class="ico">⚠️</div><div class="val" style="font-size:1.2rem">${fmt(owing.reduce((t,r)=>t+r.total,0))}</div><div class="lbl">Outstanding</div>
        <div class="trend ${owing.length?'trend-dn':'trend-up'}">${owing.length?owing.length+' student(s) to bill':'All clear!'}</div></div>
      <div class="stat-card s-blue"><div class="ico">📋</div><div class="val">${sum('sessions')}</div><div class="lbl">Sessions attended · ${_ovMonthLabel(ym)}</div></div>
      <div class="stat-card s-yellow"><div class="ico">🏦</div><div class="val" style="font-size:1.2rem">${fmt(sum('depositHeld'))}</div><div class="lbl">Deposit balance held</div></div>
    </div>`;

  const perClass = `
    <div class="card" style="margin-top:0">
      <div style="font-family:'Fredoka One',sans-serif;font-weight:800;margin-bottom:12px">🏫 Per Class · ${_ovMonthLabel(ym)}</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Class</th><th style="text-align:right">Students</th><th style="text-align:right">Sessions</th><th style="text-align:right">Revenue</th><th style="text-align:right">Outstanding</th><th style="text-align:right">Deposit</th><th></th></tr></thead>
        <tbody>${results.map(r=>`
          <tr>
            <td>${_ovDot(r.cls)}<strong>${esc(r.cls.name)}</strong>${r.cls.id===currentClassId?' <span class="chip chip-purple" style="font-size:0.62rem">Active</span>':''}</td>
            <td style="text-align:right">${r.students}</td>
            <td style="text-align:right">${r.sessions}</td>
            <td style="text-align:right">${fmt(r.revenue)}</td>
            <td style="text-align:right;color:${r.outstanding>0?'var(--red)':'var(--muted)'};font-weight:${r.outstanding>0?700:400}">${fmt(r.outstanding)}</td>
            <td style="text-align:right">${fmt(r.depositHeld)}</td>
            <td style="text-align:right"><button class="btn sm" onclick="ovOpenClass('${r.cls.id}','dashboard')">Open →</button></td>
          </tr>`).join('')}
          <tr style="font-weight:800;border-top:2px solid var(--border)">
            <td>Total</td><td style="text-align:right">${sum('students')}</td><td style="text-align:right">${sum('sessions')}</td>
            <td style="text-align:right">${fmt(sum('revenue'))}</td><td style="text-align:right;color:var(--red)">${fmt(sum('outstanding'))}</td>
            <td style="text-align:right">${fmt(sum('depositHeld'))}</td><td></td>
          </tr>
        </tbody>
      </table></div>
      ${failed.length?`<div style="margin-top:8px;font-size:0.8rem;color:var(--red)">⚠️ Could not load: ${failed.map(c=>esc(c.name)).join(', ')} — tap Refresh.</div>`:''}
    </div>`;

  const unpaid = `
    <div class="card" style="margin-top:0">
      <div style="font-family:'Fredoka One',sans-serif;font-weight:800;margin-bottom:12px">💳 To Bill — All Classes ${owing.length?`<span class="chip chip-red" style="font-size:0.7rem">${owing.length}</span>`:''}</div>
      ${!owing.length ? '<div style="color:var(--muted);font-size:0.85rem;text-align:center;padding:12px">✅ All payments are up to date in every class.</div>' :
        owing.map((r,i)=>`
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
          <div style="min-width:0">
            <div style="font-weight:700">${esc(r.siswa.nama)} <span style="font-size:0.72rem;font-weight:600;color:var(--muted)">${_ovDot(r.cls)}${esc(r.cls.name)}</span></div>
            <div style="font-size:0.78rem;color:var(--muted)">
              ${r.isMonthly ? `${r.unpaidCount} unpaid month(s)` : `${r.unpaidCount} unpaid session(s)`}${r.daysSince>14?` · oldest ${r.daysSince} days ago`:''}
              ${r.depBal>0?` · <span style="color:var(--yellow)">deposit ${fmt(r.depBal)} already deducted</span>`:''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <strong style="color:var(--red)">${fmt(r.total)}</strong>
            <button class="btn wa sm" onclick="ovSendReminder(${i})" title="Send reminder via WhatsApp">💬</button>
            <button class="btn sm" onclick="ovOpenClass('${r.cls.id}','payment')" title="Record payment in this class">💰</button>
          </div>
        </div>`).join('')}
    </div>`;

  // Jadwal mingguan gabungan
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const SHORT = {Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat',Sunday:'Sun'};
  const slots = results.flatMap(r=>r.schedule);
  const usedDays = DAYS.filter(d=>slots.some(s=>s.days.includes(d)));
  const schedule = `
    <div class="card" style="margin-top:0">
      <div style="font-family:'Fredoka One',sans-serif;font-weight:800;margin-bottom:12px">🗓️ Weekly Schedule — All Classes</div>
      ${!usedDays.length ? '<div style="color:var(--muted);font-size:0.85rem">No schedules set yet.</div>' : `
      <div style="display:grid;grid-template-columns:repeat(${usedDays.length},minmax(120px,1fr));gap:10px;overflow-x:auto">
        ${usedDays.map(d=>{
          const list = slots.filter(s=>s.days.includes(d)).sort((a,b)=>a.jam.localeCompare(b.jam));
          // tandai jam yang dipakai lebih dari satu kelas
          const clash = {}; list.forEach(s=>{ const k=s.jam; clash[k]=clash[k]||new Set(); clash[k].add(s.cls.id); });
          return `<div style="background:var(--bg3);border-radius:10px;padding:10px">
            <div style="font-weight:800;font-size:0.82rem;margin-bottom:8px">${SHORT[d]}</div>
            ${list.map(s=>`
              <div style="border-left:3px solid ${esc(s.cls.color||'#6c63ff')};padding:4px 8px;margin-bottom:6px;background:var(--bg2,transparent);border-radius:4px;font-size:0.78rem">
                <div style="font-weight:700">${esc(s.jam||'—')}${s.jam && clash[s.jam].size>1?' <span title="Same time in another class" style="color:var(--red)">⚠️</span>':''}</div>
                <div>${esc(s.nama)}</div>
                <div style="color:var(--muted);font-size:0.7rem">${esc(s.cls.name)}</div>
              </div>`).join('')}
          </div>`;
        }).join('')}
      </div>`}
    </div>`;

  return cards + perClass + unpaid + schedule;
}

// ── Aksi ──
function ovSendReminder(i){
  const owing = (_ovLastResult||[]).flatMap(r=>r.reminders).filter(r=>r.total>0).sort((a,b)=>b.total-a.total);
  const r = owing[i]; if(!r) return;
  const hp = (r.siswa.hp||'').replace(/\D/g,'');
  const url = (hp ? `https://wa.me/62${hp.replace(/^0/,'')}` : 'https://wa.me/') + '?text=' + encodeURIComponent(r.waText||'');
  window.open(url, '_blank');
}

async function ovOpenClass(classId, page){
  if(classId !== currentClassId){
    localStorage.setItem('lastPage_' + classId, page || 'dashboard');
    await switchClass(classId);
  } else {
    navigate(page || 'dashboard');
  }
}
