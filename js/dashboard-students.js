//  DASHBOARD
// ════════════════════════════════════════════════
let chartRevInst;
function setCurrentMonthDashFilter(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const lastDay = new Date(y, now.getMonth()+1, 0).getDate().toString().padStart(2,'0');
  const dari = document.getElementById('dash-dari');
  const sampai = document.getElementById('dash-sampai');
  const periode = document.getElementById('dash-periode');
  if(dari)   dari.value   = `${y}-${m}-01`;
  if(sampai) sampai.value = `${y}-${m}-${lastDay}`;
  if(periode) periode.value = '';
  renderDashboard();
}

function clearDashFilter(){
  ['dash-dari','dash-sampai','dash-periode'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  renderDashboard();
}

function renderDashboard(){
  const today = todayISO();
  const todayDay = new Date().toLocaleDateString('en-US',{weekday:'short'});

  // Read filters
  const fDari    = document.getElementById('dash-dari')?.value    || '';
  const fSampai  = document.getElementById('dash-sampai')?.value  || '';
  const fPeriode = (document.getElementById('dash-periode')?.value || '').trim().toLowerCase();
  const isFiltered = fDari || fSampai || fPeriode;

  // Filter payment list
  let filteredPay = [...bayarList];
  if(fDari)    filteredPay = filteredPay.filter(b=>b.tanggal>=fDari);
  if(fSampai)  filteredPay = filteredPay.filter(b=>b.tanggal<=fSampai);
  if(fPeriode) filteredPay = filteredPay.filter(b=>(b.periode||'').toLowerCase().includes(fPeriode));

  const totalStudents = siswaList.length;
  // Revenue: hanya Lunas dan Cicil — exclude Belum Bayar (dicatat tapi belum dibayar)
  const totalRevenue  = filteredPay.filter(b=>b.status!=='Belum Bayar').reduce((s,b)=>s+b.jumlah,0);

  // FIX: Unpaid Bills = accurate outstanding count per student (same logic as Payment page)
  const paidSesiIds = new Set();
  bayarList.forEach(b=>{ if(b.sesiIds) b.sesiIds.forEach(id=>paidSesiIds.add(id)); });

  // Count students with unpaid sessions (per_session) or unpaid months (monthly)
  let unpaid = 0;
  siswaList.forEach(s => {
    if(s.billingType==='monthly'){
      const sessionMonths = new Set();
      absensiList.filter(a=>a.siswaId===s.id&&a.status==='Hadir').forEach(a=>{
        const d=new Date(a.tanggal);
        const ym=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0');
        // If filtered by date range, only count months within range
        if(fDari && a.tanggal<fDari) return;
        if(fSampai && a.tanggal>fSampai) return;
        sessionMonths.add(ym);
      });
      const _mpi = getMonthlyPayInfo(s.id);
      const paidMonths = _mpi.paid;
      if([...sessionMonths].some(ym=>!paidMonths.has(ym))) unpaid++;   // dihitung per murid
    } else {
      const unpaidSessions = absensiList.filter(a => {
        if(a.siswaId!==s.id || a.status!=='Hadir') return false;
        if(fDari && a.tanggal<fDari) return false;
        if(fSampai && a.tanggal>fSampai) return false;
        return !paidSesiIds.has(a.id);
      }).length;
      if(unpaidSessions>0) unpaid++;
    }
  });

  // Attendance filtered
  let filteredAtt = [...absensiList];
  if(fDari)   filteredAtt = filteredAtt.filter(a=>a.tanggal>=fDari);
  if(fSampai) filteredAtt = filteredAtt.filter(a=>a.tanggal<=fSampai);
  const todayAtt      = absensiList.filter(a=>a.tanggal===today);
  const presentToday  = todayAtt.filter(a=>a.status==='Hadir').length;
  const presentFiltered = filteredAtt.filter(a=>a.status==='Hadir').length;
  const filterLabel   = isFiltered ? ' <span style="font-size:0.65rem;color:var(--yellow)">(filtered)</span>' : '';

  // Total deposit balance across all students (unaffected by date filter — it's a live pool)
  let totalDepositBalance = 0, studentsWithDeposit = 0;
  if(typeof getDepositBalance === 'function'){
    siswaList.forEach(s=>{
      const bal = getDepositBalance(s.id);
      if(bal>0){ totalDepositBalance += bal; studentsWithDeposit++; }
    });
  }

  // Total tagihan (sama dengan daftar Payment Reminders, sudah dikurangi deposit)
  const owed = (typeof computePaymentReminders==='function')
    ? computePaymentReminders().reduce((t,r)=>t+(r.total||0),0) : null;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card s-purple" style="cursor:pointer" onclick="navigate('students')" title="Go to Students"><div class="ico">👤</div><div class="val">${totalStudents}</div><div class="lbl">Total Students</div></div>
    <div class="stat-card s-green" style="cursor:pointer" onclick="navigate('analytics')" title="See revenue by month"><div class="ico">💰</div><div class="val" style="font-size:${totalRevenue>9999999?'1rem':'1.3rem'}">${fmt(totalRevenue)}</div><div class="lbl">Revenue</div></div>
    <div class="stat-card s-red" style="cursor:pointer" onclick="document.getElementById('dash-reminders-card')?.scrollIntoView({behavior:'smooth',block:'center'})" title="See who to bill">
      <div class="ico">⚠️</div><div class="val">${unpaid}</div><div class="lbl">Students to Bill</div>
      <div class="trend ${unpaid>0?'trend-dn':'trend-up'}">${owed ? fmt(owed)+' due' : (unpaid>0 ? 'Needs attention' : 'All clear!')}</div>
    </div>
    <div class="stat-card s-blue" style="cursor:pointer" onclick="navigate('attendance')" title="Go to Attendance"><div class="ico">📋</div><div class="val">${isFiltered?presentFiltered+'/'+filteredAtt.length:presentToday+'/'+(todayAtt.length||totalStudents)}</div><div class="lbl">${isFiltered?'Present':'Present Today'}</div></div>
    <div class="stat-card s-yellow" style="cursor:pointer" onclick="navigate('deposits')" title="Go to Deposits">
      <div class="ico">🏦</div>
      <div class="val" style="font-size:${totalDepositBalance>9999999?'1rem':'1.3rem'}">${fmt(totalDepositBalance)}</div>
      <div class="lbl">Deposit Balance</div>
      ${studentsWithDeposit>0?`<div class="trend trend-neu" style="font-size:0.68rem">Across ${studentsWithDeposit} student(s)</div>`:''}
    </div>
  `;

  // Hanya peringatan yang belum terlihat di kartu lain (tagihan & deposit sudah ada di kartu di atas)
  const alerts=[];
  const noEvalThisWeek = siswaList.filter(s=>{
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    return !evaluasiList.find(e=>e.siswaId===s.id && new Date(e.tanggal)>=weekAgo);
  });
  if(noEvalThisWeek.length>0 && siswaList.length>0) alerts.push(`<div class="alert-card alert-warn" style="cursor:pointer" onclick="navigate('evaluation');switchEvalTab('bulk')">📝 ${noEvalThisWeek.length} student(s) have no evaluation this week. <a href="javascript:void(0)" style="color:inherit;font-weight:800;margin-left:6px">Evaluate now →</a></div>`);
  document.getElementById('dash-alerts').innerHTML = alerts.join('');

  // Weekly schedule grid
  renderWeekGrid();

  const recentPay = filteredPay.sort((a,b)=>b.tanggal.localeCompare(a.tanggal)).slice(0,5);
  const payEl = document.getElementById('dash-payments');
  if(recentPay.length===0){
    payEl.innerHTML=`<div class="dash-empty">No payments${isFiltered?' in this period':''} yet.</div>`;
  } else {
    payEl.innerHTML = recentPay.map(b=>`
      <div class="dp-row">
        <div class="dash-av" style="background:${_dashColor(b.namaSiswa)}">${esc((b.namaSiswa||'?').trim()[0]||'?')}</div>
        <div class="dp-info"><div class="dp-name">${esc(b.namaSiswa)}</div><div class="dp-sub">${tglFmt(b.tanggal)} · ${esc(b.periode)||'-'}</div></div>
        <div class="dp-amt">${fmt(b.jumlah)}
          ${b.status==='Lunas'?'':b.status==='Cicil'?chip('Partial','chip-yellow'):chip('Unpaid','chip-red')}</div>
      </div>`).join('');
  }

  // ── Hero & kelas hari ini ──
  _renderDashHero({ noEval: noEvalThisWeek.length });
  _renderDashPeriodLabel(fDari, fSampai, fPeriode);
}

function getMonthlyRevenue(fDari='', fSampai='', fPeriode=''){
  const months={};
  let list = [...bayarList];
  if(fDari)    list=list.filter(b=>b.tanggal>=fDari);
  if(fSampai)  list=list.filter(b=>b.tanggal<=fSampai);
  if(fPeriode) list=list.filter(b=>(b.periode||'').toLowerCase().includes(fPeriode));
  list.forEach(b=>{
    if(!b.tanggal) return;
    const d=new Date(b.tanggal);
    const k=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0');
    months[k]=(months[k]||0)+b.jumlah;
  });
  const sorted=Object.keys(months).sort().slice(-12);
  return {
    labels:sorted.map(k=>{ const[y,m]=k.split('-'); return new Date(y,m-1).toLocaleString('en',{month:'short',year:'2-digit'}) }),
    data:sorted.map(k=>months[k]||0),
  };
}

function renderRevenueChart(canvasId, fDari='', fSampai='', fPeriode=''){
  const {labels,data}=getMonthlyRevenue(fDari, fSampai, fPeriode);
  const ctx=document.getElementById(canvasId)?.getContext('2d');
  if(!ctx) return;
  if(window['_chart_'+canvasId]) window['_chart_'+canvasId].destroy();
  window['_chart_'+canvasId]=new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[{label:'Revenue (Rp)',data,backgroundColor:'rgba(108,99,255,0.7)',borderColor:'rgba(108,99,255,1)',borderWidth:2,borderRadius:6}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)}}},
      scales:{y:{ticks:{color:'#7c87a0',callback:v=>fmt(v)},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#7c87a0'},grid:{display:false}}}
    }
  });
}

// ════════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════════
function openStudentForm(){
  document.getElementById('form-student-title').textContent='Add New Student';
  document.getElementById('s-id').value='';
  ['s-nama','s-nick','s-kelas','s-hp','s-catatan','s-namaOrtu','s-fee','s-feemonthly'].forEach(i=>{ const el=document.getElementById(i); if(el) el.value=''; });
  document.getElementById('s-level').value='Beginner';
  const btEl=document.getElementById('s-billingtype');
  btEl.value='per_session'; btEl.disabled=false; btEl.style.opacity=''; btEl.style.cursor='';
  const btHint=document.getElementById('billing-lock-hint');
  if(btHint) btHint.style.display='none';
  onBillingTypeChange();
  renderSchedEntries([], '__new__');
  openPanel('form-student','900px');
}
function closeStudentForm(){ closePanel('form-student') }
function openEditStudent(id){
  const s=siswaList.find(x=>x.id===id); if(!s) return;
  document.getElementById('form-student-title').textContent='Edit Student';
  document.getElementById('s-id').value=s.id;
  document.getElementById('s-nama').value=s.nama||'';
  document.getElementById('s-nick').value=s.nick||'';
  document.getElementById('s-kelas').value=s.kelas||'';
  document.getElementById('s-level').value=s.level||'Beginner';
  document.getElementById('s-hp').value=s.hp||'';
  document.getElementById('s-namaOrtu').value=s.namaOrtu||'';
  document.getElementById('s-catatan').value=s.catatan||'';
  document.getElementById('s-fee').value=s.feePerSesi||'';
  document.getElementById('s-feemonthly').value=s.feeMonthly||'';
  document.getElementById('s-billingtype').value=s.billingType||'per_session';
  onBillingTypeChange();
  // Kunci billing type jika sudah ada payment — tidak boleh diubah
  const hasPayment = bayarList.some(b=>b.siswaId===id);
  const btEl = document.getElementById('s-billingtype');
  const btHint = document.getElementById('billing-lock-hint');
  if(hasPayment){
    btEl.disabled = true;
    btEl.style.opacity = '0.55';
    btEl.style.cursor = 'not-allowed';
    if(btHint) btHint.style.display = 'block';
  } else {
    btEl.disabled = false;
    btEl.style.opacity = '';
    btEl.style.cursor = '';
    if(btHint) btHint.style.display = 'none';
  }
  // Load existing schedules for this student, keyed to their actual id
  const existing = scheduleList.filter(sc=>sc.siswaId===id);
  renderSchedEntries(existing, id);
  openPanel('form-student','900px');
  document.getElementById('form-student').scrollIntoView({behavior:'smooth'});
}
function saveStudent(){
  const nama=document.getElementById('s-nama').value.trim();
  if(!nama){ infoModal('Required Field', 'Full name is required!'); return; }
  const id=document.getElementById('s-id').value;
  const billingType=document.getElementById('s-billingtype').value||'per_session';

  // Derive hari string from pending entries for backward compat
  const dayAbbr={Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat'};
  const hariUniq=[...new Set(_pendingSchedEntries.flatMap(sc=>sc.days))].map(d=>dayAbbr[d]||d).join(' & ');

  const data={
    nama, nick:document.getElementById('s-nick').value.trim(),
    kelas:document.getElementById('s-kelas').value.trim(),
    level:document.getElementById('s-level').value,
    hp:document.getElementById('s-hp').value.trim(),
    hari: hariUniq,
    namaOrtu:document.getElementById('s-namaOrtu').value.trim(),
    catatan:document.getElementById('s-catatan').value.trim(),
    feePerSesi:Number(document.getElementById('s-fee').value)||0,
    billingType,
    feeMonthly:billingType==='monthly'?Number(document.getElementById('s-feemonthly').value)||0:0,
  };

  // Tentukan finalId dulu
  const finalId = id || uid();

  if(id){
    // Cek perubahan billing type
    const existing = siswaList.find(s=>s.id===id);
    const oldBillingType = existing?.billingType || 'per_session';
    if(existing && oldBillingType !== billingType){
      const affectedPayments = bayarList.filter(b => b.siswaId === id);
      if(affectedPayments.length > 0){
        // BLOKIR: ada payment → tidak boleh ganti billing type
        const oldLabel = oldBillingType === 'monthly' ? 'Monthly' : 'Per Session';
        const newLabel = billingType === 'monthly' ? 'Monthly' : 'Per Session';
        infoModal(
          '🚫 Cannot Change Billing Type',
          `<strong>${esc(nama)}</strong> still has <strong style="color:var(--red)">${affectedPayments.length} payment record(s)</strong> with billing type <em>${oldLabel}</em>.<br><br>` +
          `To switch to <em>${newLabel}</em>:<br>` +
          `<ol style="margin:10px 0 0 18px;line-height:2">` +
          `<li>Go to <strong>Payment</strong> page</li>` +
          `<li>Delete all payment records for this student</li>` +
          `<li>Come back here and change the billing type</li>` +
          `<li>Re-enter the payments with the new billing type</li>` +
          `</ol>`
        );
        // Reset dropdown ke nilai lama agar tidak misleading
        document.getElementById('s-billingtype').value = oldBillingType;
        onBillingTypeChange();
        return;
      }
    }
  }

  _finishSaveStudent(id, finalId, data);
}

function _finishSaveStudent(id, finalId, data){
  // Update atau tambah student ke list
  if(id){
    const i=siswaList.findIndex(s=>s.id===id);
    if(i>-1) siswaList[i]={...siswaList[i],...data};
    // Sync namaSiswa di absensi, evaluasi, bayar — update variabel lokal langsung
    // (tidak pakai DB.set per koleksi agar tidak trigger 3x saveToFirestore)
    if(data.nama){
      absensiList.forEach(a=>{ if(a.siswaId===id) a.namaSiswa=data.nama; });
      evaluasiList.forEach(e=>{ if(e.siswaId===id) e.namaSiswa=data.nama; });
      bayarList.forEach(b=>{ if(b.siswaId===id) b.namaSiswa=data.nama; });
      depositList.forEach(d=>{ if(d.siswaId===id) d.namaSiswa=data.nama; });
    }
  } else {
    siswaList.push({id:finalId,...data});
  }
  // Commit pending schedules ke scheduleList
  _commitSchedules(finalId);
  // Satu kali saveToFirestore() untuk semua perubahan sekaligus
  saveToFirestore();
  closeStudentForm(); renderStudents(); updateSelects(); updateUnpaidBadge(); updateMbnBadge();
  if(document.getElementById('page-payment').classList.contains('active')) renderPayment();
  if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  showToast(`✅ Student ${id?'updated':'added'} successfully.`,'success');
}
function deleteStudent(id){
  const s = siswaList.find(x=>x.id===id);
  if(!s) return;

  // ── Hitung data terkait ──
  const attCount  = absensiList.filter(a=>a.siswaId===id).length;
  const payCount  = bayarList.filter(b=>b.siswaId===id).length;
  const evalCount = evaluasiList.filter(e=>e.siswaId===id).length;
  const depCount  = depositList.filter(d=>d.siswaId===id).length;
  const depBalance = (typeof getDepositBalance === 'function') ? getDepositBalance(id) : 0;

  // ── BLOKIR jika ada payment ──
  if(payCount > 0){
    infoModal(
      '🚫 Cannot Delete Student',
      `<strong>${esc(s.nama)}</strong> has <strong style="color:var(--red)">${payCount} payment record(s)</strong> on file.<br><br>` +
      `Please delete all payment records for this student first, then try again.`
    );
    return;
  }

  // ── BLOKIR jika ada absensi ──
  if(attCount > 0){
    infoModal(
      '🚫 Cannot Delete Student',
      `<strong>${esc(s.nama)}</strong> has <strong style="color:var(--yellow)">${attCount} attendance record(s)</strong> on file.<br><br>` +
      `Please delete all attendance records for this student first, then try again.`
    );
    return;
  }

  // ── BLOKIR jika masih ada saldo deposit ──
  if(depBalance > 0){
    infoModal(
      '🚫 Cannot Delete Student',
      `<strong>${esc(s.nama)}</strong> still has a deposit balance of <strong style="color:var(--yellow)">${fmt(depBalance)}</strong>.<br><br>` +
      `Please refund the balance first (Deposits menu → click ↩️), then try again.`
    );
    return;
  }

  // ── Boleh hapus: hanya ada evaluasi, jadwal, dan/atau deposit history (balance=0) ──
  const extras = [];
  if(evalCount) extras.push(`${evalCount} evaluation record(s)`);
  if(depCount)  extras.push(`${depCount} deposit history entry/entries`);
  const extraInfo = extras.length ? `Their ${extras.join(' and ')} will also be removed.<br><br>` : '';
  dangerModal(
    '🗑️ Delete Student',
    `Are you sure you want to delete <strong>${esc(s.nama)}</strong>?<br><br>${extraInfo}This action cannot be undone.`,
    ()=>{
      siswaList    = siswaList.filter(x=>x.id!==id);
      evaluasiList = evaluasiList.filter(e=>e.siswaId!==id);
      scheduleList = scheduleList.filter(sc=>sc.siswaId!==id);
      depositList  = depositList.filter(d=>d.siswaId!==id);
      raporList    = raporList.filter(r=>r.siswaId!==id);
      saveToFirestore();
      renderStudents(); updateSelects(); updateUnpaidBadge(); updateMbnBadge();
      if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
      if(document.getElementById('page-deposits').classList.contains('active') && typeof renderDeposits === 'function') renderDeposits();
      showToast(`✅ ${esc(s.nama)} deleted.`, 'success');
    },
    { okText:'Delete', cancelText:'Cancel' }
  );
}

// ── Schedule slot management ──
let _pendingSchedEntries = [];
let _pendingSchedSiswaId = null;  // tracks which student the form is for

function renderSchedEntries(entries, siswaId){
  _pendingSchedSiswaId = siswaId || '__new__';
  // Deep-clone and normalize all entries to current siswaId
  _pendingSchedEntries = entries.map(e=>({...e, siswaId: _pendingSchedSiswaId}));
  const el = document.getElementById('sched-entries');
  if(!el) return;
  if(!_pendingSchedEntries.length){
    el.innerHTML='<div style="font-size:0.75rem;color:var(--muted);padding:4px 0 8px">No schedule slots yet.</div>';
    return;
  }
  const dayAbbr = {Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat'};
  el.innerHTML = _pendingSchedEntries.map((sc,i)=>`
    <div class="sched-entry">
      <div class="sched-entry-info">
        <div class="sched-entry-days">${sc.days.map(d=>dayAbbr[d]||d).join(' & ')}</div>
        <div class="sched-entry-time">${esc(sc.jam)||'—'} · ${sc.durasi||60} min</div>
      </div>
      <button class="btn sm" style="color:var(--red);border-color:var(--red)" onclick="removeSchedEntry(${i})">✕</button>
    </div>`).join('');
}

function toggleDay(el){
  el.classList.toggle('selected');
}

function addScheduleSlot(){
  const selectedDays = [...document.querySelectorAll('#sched-day-picker .day-btn.selected')].map(b=>b.dataset.day);
  if(!selectedDays.length){ showToast('Select at least one day','warning'); return; }
  const jam = document.getElementById('sched-jam').value;
  const durasi = parseInt(document.getElementById('sched-durasi').value)||60;

  // Check for duplicate day conflict within pending entries
  const existingDays = _pendingSchedEntries.flatMap(e=>e.days);
  const conflicts = selectedDays.filter(d=>existingDays.includes(d));
  if(conflicts.length){
    showToast(`${conflicts.map(d=>d.slice(0,3)).join(', ')} already assigned to another slot`,'warning');
    return;
  }

  // Always use _pendingSchedSiswaId — never read from DOM here
  const newSlot = { id:uid(), siswaId: _pendingSchedSiswaId, days:selectedDays, jam, durasi };
  _pendingSchedEntries.push(newSlot);

  // Reset day picker
  document.querySelectorAll('#sched-day-picker .day-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('sched-jam').value='';
  renderSchedEntries(_pendingSchedEntries, _pendingSchedSiswaId);
  showToast('Schedule slot added','success');
}

function removeSchedEntry(idx){
  _pendingSchedEntries.splice(idx,1);
  renderSchedEntries(_pendingSchedEntries, _pendingSchedSiswaId);
}

function _commitSchedules(finalSiswaId){
  // Remove all existing schedules for this student, replace with pending entries
  scheduleList = scheduleList.filter(sc=>sc.siswaId !== finalSiswaId && sc.siswaId !== '__new__');
  const committed = _pendingSchedEntries.map(sc=>({...sc, siswaId: finalSiswaId}));
  scheduleList.push(...committed);
  _pendingSchedEntries = [];
  _pendingSchedSiswaId = null;
}

// ── Get students scheduled for a given day name ──
function getStudentsForDay(dayName){
  const slots = scheduleList.filter(sc=>sc.days.includes(dayName));
  return slots.map(sc=>{
    const s = siswaList.find(x=>x.id===sc.siswaId);
    return s ? { ...s, schedJam:sc.jam, schedDurasi:sc.durasi } : null;
  }).filter(Boolean);
}

// ── Render weekly schedule grid on dashboard ──
function renderWeekGrid(){
  const grid = document.getElementById('dash-week-grid');
  const label = document.getElementById('week-range-label');
  if(!grid) return;

  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const monday = new Date(now); monday.setDate(now.getDate()-(dow===0?6:dow-1));
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const dayShort = ['Mon','Tue','Wed','Thu','Fri'];

  // Week range label
  const fri = new Date(monday); fri.setDate(monday.getDate()+4);
  if(label) label.textContent = `${monday.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} – ${fri.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;

  // Today's day name
  const todayName = now.toLocaleDateString('en-US',{weekday:'long'});

  // Check if any student has Sat schedule → show 6 cols
  const hasSat = scheduleList.some(sc=>sc.days.includes('Saturday'));
  if(hasSat){ days.push('Saturday'); dayShort.push('Sat'); grid.style.gridTemplateColumns='repeat(6,1fr)'; }
  else grid.style.gridTemplateColumns='repeat(5,1fr)';

  grid.innerHTML = days.map((day,i)=>{
    const isToday = day===todayName;
    const students = getStudentsForDay(day);
    const slots = students.length
      ? students.map(s=>`
          <div class="week-slot" onclick="openStudentProfile('${s.id}')" title="${esc(s.nama)}${s.schedJam?' · '+s.schedJam:''}">
            <div class="week-slot-name">${esc(s.nick)||s.nama.split(' ')[0]}</div>
            ${s.schedJam?`<div class="week-slot-time">${s.schedJam}</div>`:''}
          </div>`).join('')
      : `<div class="week-empty">—</div>`;
    return `
      <div class="week-col">
        <div class="week-col-hd${isToday?' today-col':''}">${dayShort[i]}${isToday?' ★':''}</div>
        ${slots}
      </div>`;
  }).join('');
}

// ── Billing type UI toggle ──
function onBillingTypeChange(){
  const bt=document.getElementById('s-billingtype')?.value||'per_session';
  const grpM=document.getElementById('grp-monthly-fee');
  const lbl=document.getElementById('lbl-s-fee');
  if(bt==='monthly'){
    if(grpM) grpM.style.display='block';
    if(lbl) lbl.textContent='Fee / Session (Rp) — optional';
  } else {
    if(grpM) grpM.style.display='none';
    if(lbl) lbl.textContent='Fee / Session (Rp)';
  }
}
let _stLevel = '';
let _stView = (()=>{ try{ return localStorage.getItem('studentView')||'cards'; }catch(e){ return 'cards'; } })();
function setStudentView(v){
  _stView = v==='list' ? 'list' : 'cards';
  try{ localStorage.setItem('studentView', _stView); }catch(e){}
  renderStudents();
}
function setStudentLevel(l){ _stLevel = (_stLevel===l) ? '' : l; renderStudents(); }
function _stWaUrl(hp){
  const d = String(hp||'').replace(/\D/g,'');
  if(!d) return '';
  return 'https://wa.me/' + (d.startsWith('62') ? d : '62'+d.replace(/^0/,''));
}
function _stSlots(s){
  const ab={Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat',Sunday:'Sun'};
  const slots = scheduleList.filter(sc=>sc.siswaId===s.id);
  if(!slots.length) return s.hari ? [esc(s.hari)] : [];
  return slots.flatMap(sc=>(sc.days||[]).map(d=>`${ab[d]||esc(d)}${sc.jam?' '+esc(sc.jam):''}`));
}
function renderStudents(){
  const tbody=document.getElementById('tbody-students');
  const grid=document.getElementById('st-grid');
  const empty=document.getElementById('empty-students');
  const emptyF=document.getElementById('empty-students-filter');
  const stats=document.getElementById('student-stats');
  const chipsEl=document.getElementById('st-level-chips');
  const tblWrap=document.getElementById('st-table-wrap');
  const toolbar=document.querySelector('#page-students .st-toolbar');
  tbody.innerHTML=''; if(grid) grid.innerHTML='';
  if(emptyF) emptyF.style.display='none';
  if(!siswaList.length){
    empty.style.display='block'; stats.innerHTML='';
    if(toolbar) toolbar.style.display='none'; if(tblWrap) tblWrap.style.display='none';
    return;
  }
  empty.style.display='none'; if(toolbar) toolbar.style.display='';

  // ── Ringkasan ──
  const ym = todayISO().slice(0,7);
  const monthAtt = absensiList.filter(a=>a.status==='Hadir' && (a.tanggal||'').startsWith(ym));
  const activeIds = new Set(monthAtt.map(a=>a.siswaId));
  const monthly = siswaList.filter(s=>s.billingType==='monthly').length;
  const noSched = siswaList.filter(s=>!scheduleList.some(sc=>sc.siswaId===s.id) && !s.hari).length;
  stats.innerHTML=`
    <div class="stat-card s-purple"><div class="ico">👤</div><div class="val">${siswaList.length}</div><div class="lbl">Students</div></div>
    <div class="stat-card s-green"><div class="ico">✅</div><div class="val">${activeIds.size}</div><div class="lbl">Came this month</div><div class="trend">${monthAtt.length} session(s)</div></div>
    <div class="stat-card s-blue"><div class="ico">💳</div><div class="val">${siswaList.length-monthly}<span style="font-size:0.8rem;color:var(--muted)"> / ${monthly}</span></div><div class="lbl">Per session / Monthly</div></div>
    <div class="stat-card ${noSched?'s-yellow':'s-green'}"><div class="ico">📅</div><div class="val">${noSched}</div><div class="lbl">Without schedule</div></div>`;

  // ── Filter level ──
  const levels={};
  siswaList.forEach(s=>{ const l=s.level||'—'; levels[l]=(levels[l]||0)+1; });
  if(_stLevel && !levels[_stLevel]) _stLevel='';
  if(chipsEl){
    chipsEl.innerHTML = `<button class="st-chip ${_stLevel?'':'on'}" onclick="setStudentLevel('')">All <b>${siswaList.length}</b></button>` +
      Object.entries(levels).map(([l,n])=>`<button class="st-chip ${_stLevel===l?'on':''}" onclick="setStudentLevel('${esc(l).replace(/'/g,"\\'")}')">${esc(l)} <b>${n}</b></button>`).join('');
  }
  document.getElementById('st-view-cards')?.classList.toggle('primary', _stView==='cards');
  document.getElementById('st-view-list')?.classList.toggle('primary', _stView==='list');

  const q=(document.getElementById('st-q')?.value||'').trim().toLowerCase();
  const list = siswaList.filter(s=>{
    if(_stLevel && (s.level||'—')!==_stLevel) return false;
    if(!q) return true;
    return [s.nama,s.nick,s.kelas,s.namaOrtu,s.hp].some(v=>String(v||'').toLowerCase().includes(q));
  });
  if(!list.length){
    if(emptyF) emptyF.style.display='block';
    if(tblWrap) tblWrap.style.display='none'; if(grid) grid.style.display='none';
    return;
  }
  const attCount = {}; monthAtt.forEach(a=>attCount[a.siswaId]=(attCount[a.siswaId]||0)+1);

  const feeOf = s => s.billingType==='monthly'
    ? `<span class="st-fee">${fmt(s.feeMonthly||0)}<small>/month</small></span>`
    : (s.feePerSesi ? `<span class="st-fee">${fmt(s.feePerSesi)}<small>/session</small></span>` : '<span class="st-fee muted">No fee set</span>');
  const billOf = s => s.billingType==='monthly' ? '📅 Monthly' : '💳 Per session';
  const av = s => `<div class="dash-av st-av" style="background:${_dashColor(s.nama)}">${esc((s.nama||'?').trim()[0]||'?')}</div>`;
  const actions = s => `
      <button class="btn sm icon-only" title="Edit" onclick="event.stopPropagation();openEditStudent('${s.id}')">✏️</button>
      <button class="btn danger sm icon-only" title="Delete" onclick="event.stopPropagation();deleteStudent('${s.id}')">🗑️</button>`;

  if(_stView==='list'){
    if(grid) grid.style.display='none'; tblWrap.style.display='';
    tbody.innerHTML = list.map(s=>{
      const wa=_stWaUrl(s.hp); const slots=_stSlots(s);
      return `<tr class="st-row" onclick="openStudentProfile('${s.id}')">
        <td><div class="st-who">${av(s)}<div><strong>${esc(s.nama)}</strong>${s.nick?` <span class="st-nick">${esc(s.nick)}</span>`:''}<div class="st-sub">${esc(s.kelas)||'—'}</div></div></div></td>
        <td>${levelChip(s.level)}</td>
        <td><div class="st-slots">${slots.length?slots.map(t=>`<span class="st-slot">${t}</span>`).join(''):'<span class="st-sub">—</span>'}</div></td>
        <td><div class="st-sub">${billOf(s)}</div>${feeOf(s)}</td>
        <td>${esc(s.namaOrtu)||'—'}${s.hp?`<div class="st-sub">${wa?`<a href="${wa}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 ${esc(s.hp)}</a>`:esc(s.hp)}</div>`:''}</td>
        <td class="nowrap">${actions(s)}</td>
      </tr>`;
    }).join('');
    return;
  }

  tblWrap.style.display='none'; grid.style.display='';
  grid.innerHTML = list.map(s=>{
    const wa=_stWaUrl(s.hp); const slots=_stSlots(s); const n=attCount[s.id]||0;
    return `<div class="st-card" style="--cc:${_dashColor(s.nama)}" onclick="openStudentProfile('${s.id}')" title="Open profile">
      <div class="st-card-hd">
        ${av(s)}
        <div class="st-card-name">
          <div class="st-name">${esc(s.nama)}</div>
          <div class="st-sub">${s.nick?`<span class="st-nick">${esc(s.nick)}</span> · `:''}${esc(s.kelas)||'No school set'}</div>
        </div>
        ${levelChip(s.level)}
      </div>
      <div class="st-slots">${slots.length?slots.map(t=>`<span class="st-slot">📅 ${t}</span>`).join(''):'<span class="st-slot none">No schedule yet</span>'}</div>
      <div class="st-kv">
        <div><span>${billOf(s)}</span>${feeOf(s)}</div>
        <div><span>This month</span><b class="${n?'g':''}">${n} session${n===1?'':'s'}</b></div>
      </div>
      <div class="st-card-ft">
        <div class="st-parent">${(s.namaOrtu||s.hp)?`👪 ${esc(s.namaOrtu)||'Parent'}${wa?` <a href="${wa}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Chat on WhatsApp">💬 ${esc(s.hp)}</a>`:(s.hp?` · ${esc(s.hp)}`:'')}`:'<span style="opacity:.7">No parent contact</span>'}</div>
        <div class="st-actions">${actions(s)}</div>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════


// ════════════════════════════════════════════════
//  DASHBOARD: HERO, KELAS HARI INI, LABEL PERIODE
// ════════════════════════════════════════════════
const _DASH_COLORS = ['#8b5cf6','#f43f5e','#10b981','#3b82f6','#f59e0b','#06b6d4','#ec4899','#6366f1'];
function _dashColor(name){
  let h=0; for(const ch of String(name||'')) h=(h*31+ch.charCodeAt(0))>>>0;
  return _DASH_COLORS[h % _DASH_COLORS.length];
}
function _dashMinutes(jam){ const m=String(jam||'').match(/(\d{1,2})[:.](\d{2})/); return m ? (+m[1])*60+(+m[2]) : null; }

// Sesi hari ini: dari jadwal + murid yang sudah diabsen hari ini (walau tidak terjadwal)
function getTodaySessions(){
  const now = new Date(), today = todayISO();
  const dayName = now.toLocaleDateString('en-US',{weekday:'long'});
  const nowMin = now.getHours()*60 + now.getMinutes();
  const rows = getStudentsForDay(dayName).map(s=>({ s, jam:s.schedJam||'', dur:+s.schedDurasi||60 }));
  absensiList.filter(a=>a.tanggal===today).forEach(a=>{
    if(!rows.some(r=>r.s.id===a.siswaId)){
      const s = siswaList.find(x=>x.id===a.siswaId); if(s) rows.push({ s, jam:'', dur:60 });
    }
  });
  rows.forEach(r=>{
    const att = absensiList.find(a=>a.siswaId===r.s.id && a.tanggal===today);
    const start = _dashMinutes(r.jam);
    if(att) r.state = att.status==='Hadir' ? 'done' : att.status==='Izin' ? 'excused' : 'absent';
    else if(start!=null && nowMin>=start && nowMin<start+r.dur) r.state='now';
    else if(start!=null && nowMin>=start+r.dur) r.state='late';
    else r.state='next';
    r.lesson = materiList.find(m=>m.tanggal===today && (m.target==='Semua' || m.target===r.s.id));
  });
  return rows.sort((a,b)=>(_dashMinutes(a.jam)??9999)-(_dashMinutes(b.jam)??9999));
}

function _renderDashHero(info){
  const now = new Date(), h = now.getHours();
  const greet = h<12 ? 'Good morning' : h<17 ? 'Good afternoon' : 'Good evening';
  const icon  = h<12 ? '☀️' : h<17 ? '🌤️' : '🌙';
  const name  = (typeof currentUser!=='undefined' && currentUser?.displayName) ? currentUser.displayName.split(' ')[0] : 'Teacher';
  const sessions = getTodaySessions();
  const bill = (typeof computePaymentReminders==='function') ? computePaymentReminders().filter(r=>r.total>0).length : 0;
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('dh-greet', `${greet}, ${name}! ${icon}`);
  set('dh-date', now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}) + (currentClassName ? ' · '+currentClassName : ''));
  set('dh-sessions', sessions.length);
  set('dh-bill', bill);
  set('dh-eval', info.noEval||0);
  set('dash-today-label', sessions.length ? sessions.length+' session'+(sessions.length>1?'s':'') : now.toLocaleDateString('en-GB',{weekday:'long'}));

  const el = document.getElementById('dash-today'); if(!el) return;
  if(!sessions.length){
    el.innerHTML = `<div class="dash-empty">🌈 No classes scheduled today.<br><a href="javascript:void(0)" onclick="navigate('students')">Set student schedules →</a></div>`;
    return;
  }
  const TAG = { done:['✓ Present','done'], excused:['Excused','excused'], absent:['Absent','absent'],
                now:['● Now','now'], late:['Not marked','late'], next:['Upcoming','next'] };
  el.innerHTML = sessions.map(r=>{
    const [label, cls] = TAG[r.state];
    const sub = r.lesson ? '📚 '+esc(r.lesson.topik) : [r.s.kelas?('Class '+esc(r.s.kelas)):'', esc(r.s.level||'')].filter(Boolean).join(' · ');
    const act = (r.state==='now'||r.state==='late') ? `<button class="btn sm primary dt-mark" onclick="event.stopPropagation();navigate('attendance')">Mark</button>` : '';
    return `<div class="dt-row" onclick="openStudentProfile('${r.s.id}')">
      <div class="dt-time">${r.jam ? esc(r.jam) : '—'}</div>
      <div class="dt-info"><div class="dt-name">${esc(r.s.nama)}</div><div class="dt-sub">${sub||'&nbsp;'}</div></div>
      <span class="dt-tag ${cls}">${label}</span>${act}
    </div>`;
  }).join('');
}

function _renderDashPeriodLabel(dari, sampai, periode){
  const el = document.getElementById('dash-period-label'); if(!el) return;
  let txt;
  if(periode) txt = '🏷️ ' + periode;
  else if(!dari && !sampai) txt = '📅 All time';
  else {
    const d1 = dari ? new Date(dari+'T00:00:00') : null, d2 = sampai ? new Date(sampai+'T00:00:00') : null;
    const fullMonth = d1 && d2 && d1.getDate()===1 && d1.getMonth()===d2.getMonth() && d1.getFullYear()===d2.getFullYear()
                      && new Date(d2.getFullYear(), d2.getMonth()+1, 0).getDate()===d2.getDate();
    txt = '📅 ' + (fullMonth ? d1.toLocaleDateString('en-GB',{month:'long',year:'numeric'})
                             : [dari?tglFmt(dari):'…', sampai?tglFmt(sampai):'…'].join(' – '));
  }
  el.textContent = txt;
}
