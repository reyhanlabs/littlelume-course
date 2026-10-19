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

function _ovMoney(n){
  n = +n||0; const a=Math.abs(n);
  if(a>=1e9) return 'Rp '+(n/1e9).toFixed(1).replace(/\.0$/,'').replace('.',',')+' M';
  if(a>=1e6) return 'Rp '+(n/1e6).toFixed(a>=1e7?1:2).replace(/0+$/,'').replace(/\.$/,'').replace('.',',')+' Jt';
  return fmt(n);
}
function _ovHTML(results, failed, ym){
  const sum = k => results.reduce((t,r)=>t+r[k],0);
  const allRem = results.flatMap(r=>r.reminders).sort((a,b)=>b.total-a.total);
  const owing = allRem.filter(r=>r.total>0);
  const owed = owing.reduce((t,r)=>t+r.total,0);
  const mLabel = _ovMonthLabel(ym);

  // Sesi hari ini di semua kelas (dari jadwal)
  const now = new Date();
  const todayName = now.toLocaleDateString('en-US',{weekday:'long'});
  const today = results.flatMap(r=>r.schedule).filter(s=>s.days.includes(todayName))
    .sort((a,b)=>(a.jam||'99').localeCompare(b.jam||'99'));

  // Hero
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('ov-h-classes', results.length);
  set('ov-h-today', today.length);
  set('ov-h-bill', owing.length);
  set('ov-hero-sub', `${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} · ${sum('students')} students in ${results.length} classes`);

  const cards = `
    <div class="card-grid card-grid-4 dash-stats">
      <div class="stat-card s-purple"><div class="ico">👤</div><div class="val">${sum('students')}</div><div class="lbl">Students</div><div class="trend">${results.length} classes</div></div>
      <div class="stat-card s-green"><div class="ico">💰</div><div class="val" title="${fmt(sum('revenue'))}">${_ovMoney(sum('revenue'))}</div><div class="lbl">Revenue</div><div class="trend">${mLabel}</div></div>
      <div class="stat-card s-red" style="cursor:pointer" onclick="document.getElementById('ov-bill-card')?.scrollIntoView({behavior:'smooth',block:'center'})"><div class="ico">⚠️</div><div class="val" title="${fmt(owed)}">${_ovMoney(owed)}</div><div class="lbl">Outstanding</div><div class="trend">${owing.length?owing.length+' student(s) to bill':'All clear!'}</div></div>
      <div class="stat-card s-blue"><div class="ico">📋</div><div class="val">${sum('sessions')}</div><div class="lbl">Sessions attended</div><div class="trend">${mLabel}</div></div>
      <div class="stat-card s-yellow"><div class="ico">🏦</div><div class="val" title="${fmt(sum('depositHeld'))}">${_ovMoney(sum('depositHeld'))}</div><div class="lbl">Deposit held</div></div>
    </div>`;

  const perClass = `
    <div class="card dash-card">
      <div class="dash-card-hd"><b>🏫 Per Class</b><span>${mLabel}</span></div>
      <div class="ov-classes">
        ${results.map(r=>`
        <div class="ov-class" style="--cc:${esc(r.cls.color||'#6c63ff')}" onclick="ovOpenClass('${r.cls.id}','dashboard')" title="Open ${esc(r.cls.name)}">
          <div class="ov-class-hd"><span class="ov-dot"></span><b title="${esc(r.cls.name)}">${esc(r.cls.name)}</b>${r.cls.id===currentClassId?'<span class="ov-active">Active</span>':''}<span class="ov-open">→</span></div>
          <div class="ov-kv">
            <div><span>Students</span><b>${r.students}</b></div>
            <div><span>Sessions</span><b>${r.sessions}</b></div>
            <div><span>Revenue</span><b class="g" title="${fmt(r.revenue)}">${_ovMoney(r.revenue)}</b></div>
            <div><span>Outstanding</span><b class="${r.outstanding>0?'r':''}" title="${fmt(r.outstanding)}">${_ovMoney(r.outstanding)}</b></div>
          </div>
        </div>`).join('')}
      </div>
      ${failed.length?`<div style="margin-top:8px;font-size:0.8rem;color:var(--red)">⚠️ Could not load: ${failed.map(c=>esc(c.name)).join(', ')} — tap Refresh.</div>`:''}
    </div>`;

  const todayCard = `
    <div class="card dash-card" id="ov-today-card">
      <div class="dash-card-hd"><b>🎈 Today in All Classes</b><span>${today.length} session${today.length===1?'':'s'}</span></div>
      ${!today.length ? '<div class="dash-empty">🌈 No classes scheduled today.</div>' :
        '<div class="ov-scroll">'+today.map(s=>`
        <div class="dt-row" onclick="ovOpenClass('${s.cls.id}','dashboard')">
          <div class="dt-time">${esc(s.jam||'—')}</div>
          <div class="dt-info"><div class="dt-name">${esc(s.nama)}</div><div class="dt-sub">${_ovDot(s.cls)}${esc(s.cls.name)}</div></div>
        </div>`).join('')+'</div>'}
    </div>`;

  const unpaid = `
    <div class="card dash-card" id="ov-bill-card">
      <div class="dash-card-hd"><b>🔔 To Bill</b>${owing.length?`<span class="chip chip-red">${owing.length} · ${fmt(owed)}</span>`:''}</div>
      ${!owing.length ? '<div class="dash-empty">🎉 All payments are up to date in every class.</div>' :
        '<div class="ov-scroll">'+owing.map((r,i)=>`
        <div class="dp-row">
          <div class="dash-av" style="background:${typeof _dashColor==='function'?_dashColor(r.siswa.nama):'#8b5cf6'}">${esc((r.siswa.nama||'?').trim()[0]||'?')}</div>
          <div class="dp-info">
            <div class="dp-name">${esc(r.siswa.nama)}</div>
            <div class="dp-sub">${_ovDot(r.cls)}${esc(r.cls.name)} · ${r.isMonthly ? `${r.unpaidCount} unpaid month(s)` : `${r.unpaidCount} unpaid session(s)`}${r.depBal>0?` · deposit ${fmt(r.depBal)} deducted`:''}</div>
          </div>
          <div class="dp-amt" style="color:var(--red)" title="${fmt(r.total)}">${_ovMoney(r.total)}</div>
          <button class="btn wa sm" onclick="ovSendReminder(${i})" title="Send reminder via WhatsApp">💬</button>
          <button class="btn sm" onclick="ovOpenClass('${r.cls.id}','payment')" title="Record payment in this class">💰</button>
        </div>`).join('')+'</div>'}
    </div>`;

  // Jadwal mingguan gabungan
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const SHORT = {Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat',Sunday:'Sun'};
  const slots = results.flatMap(r=>r.schedule);
  const usedDays = DAYS.filter(d=>slots.some(s=>s.days.includes(d)));
  const schedule = `
    <div class="card dash-card">
      <div class="dash-card-hd"><b>🗓️ Weekly Schedule</b><span>all classes</span></div>
      ${!usedDays.length ? '<div class="dash-empty">No schedules set yet.</div>' : `
      <div class="ov-week" style="grid-template-columns:repeat(${usedDays.length},minmax(110px,1fr))">
        ${usedDays.map(d=>{
          const list = slots.filter(s=>s.days.includes(d)).sort((a,b)=>a.jam.localeCompare(b.jam));
          const clash = {}; list.forEach(s=>{ const k=s.jam; clash[k]=clash[k]||new Set(); clash[k].add(s.cls.id); });
          return `<div class="ov-day${d===todayName?' today':''}">
            <div class="ov-day-hd">${SHORT[d]}${d===todayName?' ★':''} <small>${list.length}</small></div>
            <div class="ov-day-list">${list.map(s=>`
              <div class="ov-slot" style="--cc:${esc(s.cls.color||'#6c63ff')}">
                <b>${esc(s.jam||'—')}${s.jam && clash[s.jam].size>1?' <span title="Same time in another class" style="color:var(--red)">⚠️</span>':''}</b>
                <div>${esc(s.nama)}</div>
                <small>${esc(s.cls.name)}</small>
              </div>`).join('')}</div>
          </div>`;
        }).join('')}
      </div>`}
    </div>`;

  return cards + perClass + `<div class="dash-main"><div class="dash-col">${unpaid}</div><div class="dash-col">${todayCard}</div></div>` + schedule;
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
