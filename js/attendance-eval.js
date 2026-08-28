//  ATTENDANCE
// ════════════════════════════════════════════════
function loadAbsensi(){
  const d=document.getElementById('absen-date').value; if(!d) return;
  const dt=new Date(d), day=dt.getDay();
  const mon=new Date(dt); mon.setDate(dt.getDate()-(day===0?6:day-1));
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  document.getElementById('week-label').textContent=
    `Week: ${mon.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} – ${sun.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;

  // Schedule hint
  const dayName = dt.toLocaleDateString('en-US',{weekday:'long'});
  const scheduledToday = getStudentsForDay(dayName);
  const hintEl = document.getElementById('sched-hint');
  const hintTxt = document.getElementById('sched-hint-text');
  if(hintEl && scheduledToday.length){
    hintEl.style.display='block';
    hintTxt.textContent = `${scheduledToday.length} student${scheduledToday.length>1?'s':''} (${scheduledToday.map(s=>s.nick||s.nama.split(' ')[0]).join(', ')})`;
  } else if(hintEl){
    hintEl.style.display='none';
  }

  // Jika mode Single aktif, sync tanggal ke form single lalu stop
  if(_attMode === 'single'){
    const singleTgl = document.getElementById('single-att-tanggal');
    if(singleTgl && !singleTgl.value) singleTgl.value = d;
    return;
  }

  const grid=document.getElementById('absen-grid');
  if(!siswaList.length){ grid.innerHTML='<div class="empty"><div class="ei">📋</div><p>Add students first.</p></div>'; return; }
  const existing={};
  absensiList.filter(a=>a.tanggal===d).forEach(a=>existing[a.siswaId]=a);

  // Sort: scheduled students for this day first
  const scheduledIds = new Set(scheduledToday.map(s=>s.id));
  const sorted = [...siswaList].sort((a,b)=>{
    const aS = scheduledIds.has(a.id)?0:1;
    const bS = scheduledIds.has(b.id)?0:1;
    return aS-bS || a.nama.localeCompare(b.nama);
  });

  grid.innerHTML=sorted.map(s=>{
    const isScheduled = scheduledIds.has(s.id);
    const sc = scheduleList.find(x=>x.siswaId===s.id && x.days.includes(dayName));
    return `
    <div class="absen-card" ${isScheduled?'':'style="opacity:0.65"'}>
      <div class="a-name">👤 ${s.nama}${isScheduled?` <span style="font-size:0.65rem;background:rgba(108,99,255,0.15);color:var(--accent);border-radius:4px;padding:1px 5px;font-weight:700">📅 ${sc?.jam||'Scheduled'}</span>`:''}</div>
      ${s.nick?`<div class="a-nick">${s.nick}</div>`:''}
      <select id="att-${s.id}">
        <option value="Hadir" ${existing[s.id]?.status==='Hadir'?'selected':''}>✅ Present</option>
        <option value="Izin"  ${existing[s.id]?.status==='Izin'?'selected':''}>📝 Excused</option>
        <option value="Alpha" ${existing[s.id]?.status==='Alpha'?'selected':''}>❌ Absent</option>
      </select>
      <input type="text" placeholder="Note (optional)" id="att-ket-${s.id}" value="${existing[s.id]?.keterangan||''}">
    </div>`;
  }).join('');
}
function saveAbsensi(){
  const d=document.getElementById('absen-date').value;
  if(!d){ showToast('Select a date first!','warn'); return; }
  if(!siswaList.length){ showToast('No students found!','warn'); return; }
  // ── Simpan snapshot record lama sebelum dihapus ──
  // ID lama HARUS dipertahankan agar sesiIds di payment tidak putus
  const oldRecords={};
  absensiList.filter(a=>a.tanggal===d).forEach(a=>{ oldRecords[a.siswaId]=a; });
  absensiList=absensiList.filter(a=>a.tanggal!==d);
  siswaList.forEach(s=>{
    const old=oldRecords[s.id];
    absensiList.push({
      id: old ? old.id : uid(),   // ← PAKAI ID LAMA jika sudah pernah ada
      tanggal:d,siswaId:s.id,namaSiswa:s.nama,
      status:document.getElementById(`att-${s.id}`)?.value||'Hadir',
      keterangan:document.getElementById(`att-ket-${s.id}`)?.value||'',
    });
  });
  DB.set('absensi',absensiList); renderAttendance(); showToast('✅ Attendance saved!','success');
}
// ════════════════════════════════════════════════
//  SINGLE STUDENT ATTENDANCE
// ════════════════════════════════════════════════
let _attMode = 'all';

function setAttMode(mode){
  _attMode = mode;
  const isAll = mode === 'all';
  document.getElementById('att-mode-all').classList.toggle('primary', isAll);
  document.getElementById('att-mode-single').classList.toggle('primary', !isAll);
  document.getElementById('single-att-panel').style.display = isAll ? 'none' : 'block';
  document.getElementById('all-att-grid-card').style.display = isAll ? 'block' : 'none';
  // Sembunyikan tombol Save Attendance (All) saat mode Single aktif
  const saveBtn = document.querySelector('#page-attendance .sec-hd .btn.primary');
  if(saveBtn) saveBtn.style.display = isAll ? '' : 'none';

  if(!isAll){
    // Isi dropdown siswa
    const sel = document.getElementById('single-att-siswa');
    const opts = siswaList.map(s=>`<option value="${s.id}">${s.nama}${s.nick?' ('+s.nick+')':''}</option>`).join('');
    sel.innerHTML = '<option value="">-- Pilih Siswa --</option>' + opts;
    // Default tanggal = hari ini
    if(!document.getElementById('single-att-tanggal').value){
      document.getElementById('single-att-tanggal').value = new Date().toISOString().slice(0,10);
    }
    onSingleAttSiswaChange();
  }
}

function onSingleAttSiswaChange(){
  const siswaId = document.getElementById('single-att-siswa').value;
  const tanggal = document.getElementById('single-att-tanggal').value;
  const infoEl  = document.getElementById('single-att-info');
  if(!siswaId || !tanggal){ infoEl.textContent=''; return; }

  const existing = absensiList.find(a=>a.siswaId===siswaId && a.tanggal===tanggal);
  if(existing){
    infoEl.innerHTML = `<span style="color:var(--yellow)">⚠️ Sudah ada record untuk tanggal ini: <strong>${existing.status}</strong>${existing.keterangan?' · '+existing.keterangan:''}. Akan ditimpa jika disimpan.</span>`;
    document.getElementById('single-att-status').value = existing.status;
    document.getElementById('single-att-ket').value    = existing.keterangan||'';
  } else {
    const isFuture = tanggal > new Date().toISOString().slice(0,10);
    infoEl.innerHTML = isFuture
      ? `<span style="color:var(--teal)">📅 Tanggal mendatang — cocok untuk catat sesi yang sudah dibayar di muka.</span>`
      : '';
  }
}

function saveSingleAtt(){
  const siswaId = document.getElementById('single-att-siswa').value;
  const tanggal = document.getElementById('single-att-tanggal').value;
  const status  = document.getElementById('single-att-status').value;
  const ket     = document.getElementById('single-att-ket').value.trim();

  if(!siswaId){ showToast('Pilih siswa terlebih dahulu!','warn'); return; }
  if(!tanggal){ showToast('Pilih tanggal!','warn'); return; }

  const siswa = siswaList.find(s=>s.id===siswaId);

  // Cek apakah sudah ada record untuk siswa+tanggal ini
  const existingIdx = absensiList.findIndex(a=>a.siswaId===siswaId && a.tanggal===tanggal);

  // Cek apakah record lama ini sudah terhubung ke payment
  if(existingIdx > -1 && status !== absensiList[existingIdx].status){
    const existingId = absensiList[existingIdx].id;
    const linkedPayment = bayarList.find(b=>b.sesiIds && b.sesiIds.includes(existingId));
    if(linkedPayment && absensiList[existingIdx].status === 'Hadir'){
      showToast(`⚠️ Status tidak bisa diubah — sesi ini sudah terhubung ke payment (${linkedPayment.namaSiswa}).`,'warn');
      return;
    }
  }

  if(existingIdx > -1){
    // Update record yang sudah ada, pertahankan ID
    absensiList[existingIdx] = {
      ...absensiList[existingIdx],
      status, keterangan: ket, namaSiswa: siswa?.nama||'-',
    };
  } else {
    absensiList.push({
      id: uid(),
      tanggal, siswaId, namaSiswa: siswa?.nama||'-',
      status, keterangan: ket,
    });
  }

  DB.set('absensi', absensiList);
  renderAttendance();
  updateUnpaidBadge(); updateMbnBadge();
  if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();

  const isFuture = tanggal > new Date().toISOString().slice(0,10);
  showToast(
    `✅ Attendance ${existingIdx>-1?'updated':'saved'} — ${siswa?.nama}, ${tglFmt(tanggal)}, ${status}` +
    (isFuture ? ' 📅 (future date)' : ''),
    'success'
  );

  // Reset form untuk input berikutnya
  document.getElementById('single-att-siswa').value  = '';
  document.getElementById('single-att-ket').value    = '';
  document.getElementById('single-att-status').value = 'Hadir';
  document.getElementById('single-att-tanggal').value = new Date().toISOString().slice(0,10);
  document.getElementById('single-att-info').textContent = '';
}

function setCurrentMonthAttFilter(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const lastDay = new Date(y, now.getMonth()+1, 0).getDate().toString().padStart(2,'0');
  document.getElementById('att-f-dari').value   = `${y}-${m}-01`;
  document.getElementById('att-f-sampai').value = `${y}-${m}-${lastDay}`;
  document.getElementById('att-f-nama').value   = '';
  const st = document.getElementById('att-f-status'); if(st) st.value='';
  renderAttendance();
}

function clearAttFilter(){
  ['att-f-dari','att-f-sampai','att-f-nama'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const st=document.getElementById('att-f-status'); if(st) st.value='';
  renderAttendance();
}

function renderAttendance(){
  const tbody  = document.getElementById('tbody-attendance');
  const empty  = document.getElementById('empty-attendance');
  const sumEl  = document.getElementById('att-summary');
  tbody.innerHTML='';

  const fDari   = document.getElementById('att-f-dari')?.value   || '';
  const fSampai = document.getElementById('att-f-sampai')?.value || '';
  const fNama   = (document.getElementById('att-f-nama')?.value  || '').trim().toLowerCase();
  const fStatus = document.getElementById('att-f-status')?.value || '';

  let list = [...absensiList].sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  if(fDari)   list = list.filter(a=>a.tanggal>=fDari);
  if(fSampai) list = list.filter(a=>a.tanggal<=fSampai);
  if(fNama)   list = list.filter(a=>a.namaSiswa.toLowerCase().includes(fNama));
  if(fStatus) list = list.filter(a=>a.status===fStatus);

  // Summary
  if(sumEl){
    const present = list.filter(a=>a.status==='Hadir').length;
    const excused = list.filter(a=>a.status==='Izin').length;
    const absent  = list.filter(a=>a.status==='Alpha').length;
    const total   = list.length;
    sumEl.innerHTML = total ? `
      <span class="chip chip-muted">${total} records</span>
      <span class="chip chip-green">✅ Present: ${present}</span>
      <span class="chip chip-yellow">📝 Excused: ${excused}</span>
      <span class="chip chip-red">❌ Absent: ${absent}</span>
      ${total>0?`<span class="chip chip-blue">📊 Rate: ${Math.round((present/total)*100)}%</span>`:''}
    ` : '';
  }

  if(!absensiList.length){ empty.style.display='block'; return; }
  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(a=>{
    const c=a.status==='Hadir'?'chip-green':a.status==='Izin'?'chip-yellow':'chip-red';
    const l=a.status==='Hadir'?'Present':a.status==='Izin'?'Excused':'Absent';
    tbody.innerHTML+=`<tr>
      <td>${tglFmt(a.tanggal)}</td>
      <td><strong>${a.namaSiswa}</strong></td>
      <td>${chip(l,c)}</td>
      <td style="color:var(--muted);font-size:0.83rem">${a.keterangan||'-'}</td>
      <td class="nowrap">
        <button class="btn sm icon-only" title="Edit" onclick="editAttendance('${a.id}')" style="margin-right:4px">✏️</button>
        <button class="btn danger sm icon-only" title="Delete" onclick="deleteAttendance('${a.id}')">🗑️</button>
      </td>
    </tr>`;
  });
}

function editAttendance(id){
  const a = absensiList.find(x=>x.id===id); if(!a) return;
  document.getElementById('att-edit-id').value       = a.id;
  document.getElementById('att-edit-tanggal').value  = a.tanggal;
  document.getElementById('att-edit-nama').textContent = a.namaSiswa;
  document.getElementById('att-edit-status').value   = a.status;
  document.getElementById('att-edit-note').value     = a.keterangan||'';
  openModal('modal-att-edit');
}

function saveAttEdit(){
  const id = document.getElementById('att-edit-id').value;
  const idx = absensiList.findIndex(a=>a.id===id);
  if(idx===-1) return;
  
  const oldStatus = absensiList[idx].status;
  const newStatus = document.getElementById('att-edit-status').value;
  
  // ✅ VALIDATION: Check if payment exists for this session
  if(oldStatus === 'Hadir' && newStatus !== 'Hadir') {
    const paymentWithThisSesi = bayarList.find(b => 
      b.sesiIds && b.sesiIds.includes(id)
    );
    
    if(paymentWithThisSesi) {
      dangerModal(
        '⚠️ Payment Record Exists',
        `<div style="text-align: left; line-height: 1.8">
          <p>❌ Cannot change status.</p>
          <p>Payment record exists for this session:</p>
          <div style="background: var(--bg3); padding: 12px; border-radius: 8px; margin: 12px 0; border-left: 4px solid var(--yellow)">
            <div>👤 <strong>${paymentWithThisSesi.namaSiswa || 'N/A'}</strong></div>
            <div>📅 ${tglFmt(paymentWithThisSesi.tanggal)}</div>
            <div>💰 ${fmt(paymentWithThisSesi.jumlah)} (${paymentWithThisSesi.status})</div>
          </div>
          <p>💡 Delete the payment first, then try again.</p>
        </div>`,
        null,
        { okText: 'OK', cancelText: null }
      );
      return;  // ← BLOCK
    }
  }
  
  // ✅ SAFE: No payment, can change
  absensiList[idx] = {
    ...absensiList[idx],
    status:     newStatus,
    keterangan: document.getElementById('att-edit-note').value.trim(),
  };
  
  DB.set('absensi', absensiList);
  closeModal('modal-att-edit');
  renderAttendance();
  renderPayment();
  updateUnpaidBadge(); updateMbnBadge();
  if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  showToast(`✅ Status changed to ${newStatus}`, 'success');
}

function deleteAttendance(id){
  // ✅ VALIDATION: Check apakah attendance ini ada di pembayaran
  const paymentWithThisAttendance = bayarList.find(b => 
    b.sesiIds && b.sesiIds.includes(id)
  );
  
  if(paymentWithThisAttendance){
    // ❌ BLOCK: Ada pembayaran yang reference attendance ini
    dangerModal(
      '❌ Cannot Delete',
      `This attendance has an associated payment:<br><br>` +
      `<strong>Student:</strong> ${paymentWithThisAttendance.namaSiswa}<br>` +
      `<strong>Status:</strong> ${paymentWithThisAttendance.status}<br>` +
      `<strong>Amount:</strong> ${fmt(paymentWithThisAttendance.jumlah)}<br><br>` +
      `Please delete the payment record first, then you can delete this attendance.`,
      null,
      { okText: 'Close', cancelText: null }
    );
    return;
  }
  
  // ✅ ALLOWED: Tidak ada pembayaran, boleh delete
  dangerModal(
    '🗑️ Delete Attendance?',
    'Are you sure you want to delete this attendance record? This action cannot be undone.',
    () => {
      absensiList = absensiList.filter(a=>a.id!==id);
      DB.set('absensi', absensiList);
      renderAttendance();
      updateUnpaidBadge(); updateMbnBadge();
      if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
      showToast('✅ Attendance deleted', 'success');
    },
    { okText: 'Delete', cancelText: 'Cancel' }
  );
}

// ════════════════════════════════════════════════
//  LESSONS
// ════════════════════════════════════════════════
function resetLessonForm(){
  document.getElementById('form-lesson-title').textContent='Add Lesson';
  document.getElementById('m-id').value='';
  document.getElementById('m-tanggal').value=new Date().toISOString().slice(0,10);
  document.getElementById('m-status').value='Rencana';
  ['m-topik','m-deskripsi','m-sumber'].forEach(i=>document.getElementById(i).value='');
}
function openEditLesson(id){
  const m=materiList.find(x=>x.id===id); if(!m) return;
  document.getElementById('form-lesson-title').textContent='Edit Lesson';
  document.getElementById('m-id').value=m.id;
  document.getElementById('m-tanggal').value=m.tanggal||'';
  document.getElementById('m-status').value=m.status||'Rencana';
  document.getElementById('m-topik').value=m.topik||'';
  document.getElementById('m-deskripsi').value=m.deskripsi||'';
  document.getElementById('m-sumber').value=m.sumber||'';
  document.getElementById('m-target').value=m.target||'Semua';
  openPanel('form-lesson','700px');
  document.getElementById('form-lesson').scrollIntoView({behavior:'smooth'});
}
function saveLesson(){
  const topik=document.getElementById('m-topik').value.trim();
  if(!topik){ infoModal('Required Field', 'Topic is required!'); return; }
  const id=document.getElementById('m-id').value;
  const data={
    tanggal:document.getElementById('m-tanggal').value,
    status:document.getElementById('m-status').value, topik,
    deskripsi:document.getElementById('m-deskripsi').value.trim(),
    sumber:document.getElementById('m-sumber').value.trim(),
    target:document.getElementById('m-target').value,
  };
  if(id){ const i=materiList.findIndex(m=>m.id===id); if(i>-1) materiList[i]={...materiList[i],...data}; }
  else materiList.push({id:uid(),...data});
  DB.set('materi',materiList);
  document.getElementById('m-id').value='';
  ['m-topik','m-deskripsi','m-sumber'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('form-lesson-title').textContent='Add Lesson';
  closePanel('form-lesson'); renderLessons();
}
function deleteLesson(id){
  const m = materiList.find(x=>x.id===id);
  dangerModal('🗑️ Delete Lesson', `Delete lesson <strong>${m?.topik||'this lesson'}</strong>?`,
    ()=>{ materiList=materiList.filter(m=>m.id!==id); DB.set('materi',materiList); renderLessons(); },
    { okText:'Delete', cancelText:'Keep' }
  );
}
function renderLessons(){
  const rencana=materiList.filter(m=>m.status==='Rencana').sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const selesai=materiList.filter(m=>m.status==='Selesai').sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  const makeCard=(m)=>`
    <div class="lesson-card">
      <div class="lesson-dot ${m.status==='Rencana'?'planned':'done'}"></div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.92rem">${m.topik}</div>
        <div style="font-size:0.77rem;color:var(--muted);margin-top:3px">${tglFmt(m.tanggal)} · ${m.target==='Semua'?'All Students':m.target||'All'}</div>
        ${m.deskripsi?`<div style="font-size:0.85rem;color:var(--muted);margin-top:8px">${m.deskripsi}</div>`:''}
        ${m.sumber?`<div style="font-size:0.77rem;color:var(--accent);margin-top:5px">📎 ${m.sumber}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn sm icon-only" title="Print" onclick="showLessonPrint('${m.id}')">🖨️</button>
        <button class="btn sm icon-only" title="Edit" onclick="openEditLesson('${m.id}')">✏️</button>
        <button class="btn danger sm icon-only" title="Delete" onclick="deleteLesson('${m.id}')">🗑️</button>
      </div>
    </div>`;
  document.getElementById('lesson-planned').innerHTML=rencana.length?rencana.map(makeCard).join(''):'<div style="color:var(--muted);font-size:0.85rem;padding:10px 0">No planned lessons.</div>';
  document.getElementById('lesson-done').innerHTML=selesai.length?selesai.map(makeCard).join(''):'<div style="color:var(--muted);font-size:0.85rem;padding:10px 0">No completed lessons.</div>';
  document.getElementById('empty-lessons').style.display=materiList.length?'none':'block';
}

// ════════════════════════════════════════════════
//  EVALUATION
// ════════════════════════════════════════════════
function saveEval(){
  const siswaId=document.getElementById('e-siswa').value;
  if(!siswaId){ infoModal('Required Field', 'Please select a student first!'); return; }
  const s=siswaList.find(x=>x.id===siswaId);
  const id=document.getElementById('e-id').value;
  const data={
    tanggal:document.getElementById('e-tanggal').value,
    siswaId, namaSiswa:s?.nama||'-',
    nilai:document.getElementById('e-nilai').value,
    rating:document.getElementById('e-rating').value,
    progress:document.getElementById('e-progress').value.trim(),
    catatan:document.getElementById('e-catatan').value.trim(),
  };
  if(id){ const i=evaluasiList.findIndex(e=>e.id===id); if(i>-1) evaluasiList[i]={...evaluasiList[i],...data}; }
  else evaluasiList.push({id:uid(),...data});
  DB.set('evaluasi',evaluasiList);
  document.getElementById('e-id').value='';
  ['e-nilai','e-progress','e-catatan'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('form-eval-title').textContent='Add Evaluation';
  closeEvalForm(); renderEval();
}
function deleteEval(id){
  dangerModal('🗑️ Delete Evaluation', 'Are you sure you want to delete this evaluation record?',
    ()=>{ evaluasiList=evaluasiList.filter(e=>e.id!==id); DB.set('evaluasi',evaluasiList); renderEval(); },
    { okText:'Delete', cancelText:'Keep' }
  );
}
function closeEvalForm(){
  document.getElementById('eval-form-card').style.display='none';
}
function clearEvalFilter(){
  ['eval-filter-siswa','eval-filter-dari','eval-filter-sampai'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderEval();
}
function renderEval(){
  const list   = document.getElementById('eval-list');
  const empty  = document.getElementById('empty-eval');
  const fSiswa = document.getElementById('eval-filter-siswa')?.value||'';
  const fDari  = document.getElementById('eval-filter-dari')?.value||'';
  const fSampai= document.getElementById('eval-filter-sampai')?.value||'';

  let sorted=[...evaluasiList].sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  if(fSiswa)  sorted=sorted.filter(e=>e.siswaId===fSiswa);
  if(fDari)   sorted=sorted.filter(e=>e.tanggal>=fDari);
  if(fSampai) sorted=sorted.filter(e=>e.tanggal<=fSampai);

  if(!sorted.length){ list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';

  const ratingLabel=['','Passive','Below Avg','Average','Good','Excellent'];
  list.innerHTML = sorted.map(e=>{
    const n=Number(e.nilai||0);
    const bg=n>=80?'var(--green)':n>=60?'var(--yellow)':'var(--red)';
    const starRow='⭐'.repeat(Number(e.rating)||0);
    return `
    <div class="eval-card">
      <div class="eval-score-badge" style="background:${bg}">${e.nilai||'—'}</div>
      <div class="eval-meta">
        <div class="eval-student">${e.namaSiswa}</div>
        <div class="eval-date-row">
          <span>${tglFmt(e.tanggal)}</span>
          ${e.rating?`<span style="font-size:0.9rem">${starRow}</span><span style="color:var(--accent);font-weight:700">${ratingLabel[Number(e.rating)]||''}</span>`:''}
        </div>
        ${e.progress?`<div class="eval-text"><strong>Progress:</strong> ${e.progress}</div>`:''}
        ${e.catatan?`<div class="eval-text"><strong>Notes:</strong> ${e.catatan}</div>`:''}
      </div>
      <div class="eval-actions">
        <button class="btn sm" title="Print" onclick="showEvalPrint('${e.id}')">🖨️</button>
        <button class="btn sm" title="Edit" onclick="openEditEval('${e.id}')">✏️</button>
        <button class="btn danger sm" title="Delete" onclick="deleteEval('${e.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function resetEvalForm(){
  document.getElementById('form-eval-title').textContent='Add Evaluation';
  document.getElementById('e-id').value='';
  document.getElementById('e-tanggal').value=new Date().toISOString().split('T')[0];
  document.getElementById('e-siswa').value='';
  document.getElementById('e-nilai').value='';
  document.getElementById('e-rating').value='5';
  document.getElementById('e-progress').value='';
  document.getElementById('e-catatan').value='';
  document.getElementById('eval-form-card').style.display='block';
  document.getElementById('eval-form-card').scrollIntoView({behavior:'smooth',block:'start'});
}

function openEditEval(id){
  const e=evaluasiList.find(x=>x.id===id); if(!e) return;
  switchEvalTab('single');
  document.getElementById('form-eval-title').textContent='Edit Evaluation';
  document.getElementById('e-id').value=e.id;
  document.getElementById('e-tanggal').value=e.tanggal||'';
  document.getElementById('e-siswa').value=e.siswaId||'';
  document.getElementById('e-nilai').value=e.nilai||'';
  document.getElementById('e-rating').value=e.rating||'5';
  document.getElementById('e-progress').value=e.progress||'';
  document.getElementById('e-catatan').value=e.catatan||'';
  document.getElementById('eval-form-card').style.display='block';
  document.getElementById('eval-form-card').scrollIntoView({behavior:'smooth',block:'start'});
}

// ════════════════════════════════════════════════
//  MONTHLY ATTENDANCE REPORT EXPORT
// ════════════════════════════════════════════════
function openAttReportModal(){
  const monthInput = document.getElementById('att-report-month');
  if(!monthInput.value){
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
  document.getElementById('att-report-info').textContent =
    `Class: ${currentClassName || '-'}`;
  openModal('modal-att-report');
}

function _buildAttReportHTML(monthStr){
  // monthStr format: "YYYY-MM"
  const [y,m] = monthStr.split('-');
  const monthDate = new Date(Number(y), Number(m)-1, 1);
  const monthLabel = monthDate.toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase();

  const recordsInMonth = absensiList.filter(a=>a.tanggal && a.tanggal.startsWith(monthStr));

  // distinct dates, sorted
  const dates = [...new Set(recordsInMonth.map(a=>a.tanggal))].sort();

  // students who have at least 1 record this month, sorted by name
  const studentIds = [...new Set(recordsInMonth.map(a=>a.siswaId))];
  const students = studentIds
    .map(id => siswaList.find(s=>s.id===id) || {id, nama: recordsInMonth.find(a=>a.siswaId===id)?.namaSiswa || 'Unknown'})
    .sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));

  let totalPresent=0, totalExcused=0, totalAbsent=0;

  const dateColWidth = dates.length > 6 ? 'font-size:8px;padding:6px 2px' : 'font-size:9px;padding:8px 2px';

  const rows = students.map((s,idx)=>{
    const studentRecords = recordsInMonth.filter(a=>a.siswaId===s.id);
    const p = studentRecords.filter(a=>a.status==='Hadir').length;
    const i = studentRecords.filter(a=>a.status==='Izin').length;
    const a = studentRecords.filter(a=>a.status==='Alpha').length;
    totalPresent+=p; totalExcused+=i; totalAbsent+=a;
    const total = studentRecords.length;
    const pct = total ? Math.round((p/total)*100) : 0;

    const marks = dates.map(d=>{
      const rec = studentRecords.find(a=>a.tanggal===d);
      if(!rec) return `<td style="${dateColWidth}"><span style="color:#d0d0d8">–</span></td>`;
      if(rec.status==='Hadir') return `<td style="${dateColWidth}"><span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#00d68f;color:#fff;align-items:center;justify-content:center;font-size:10px">✓</span></td>`;
      if(rec.status==='Izin')  return `<td style="${dateColWidth}"><span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#ffb347;color:#fff;align-items:center;justify-content:center;font-size:9px">I</span></td>`;
      return `<td style="${dateColWidth}"><span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#ff4f6d;color:#fff;align-items:center;justify-content:center;font-size:10px">✕</span></td>`;
    }).join('');

    const initials = (s.nama||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const rowBg = idx%2===1 ? 'background:rgba(167,139,250,0.045)' : '';

    return `<tr style="${rowBg}">
      <td style="font-size:10.5px;text-align:center;padding:11px 2px;border-bottom:1px solid rgba(58,53,96,0.06);width:22px">${idx+1}</td>
      <td style="font-size:10.5px;font-weight:700;text-align:left;padding:11px 2px 11px 12px;border-bottom:1px solid rgba(58,53,96,0.06)">
        <span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#38bdf8);color:#fff;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'Fredoka One',sans-serif">${initials}</span>
        &nbsp;${s.nama}
      </td>
      ${marks}
      <td style="font-size:10.5px;text-align:center;padding:11px 2px;border-bottom:1px solid rgba(58,53,96,0.06);color:#00c9a7;font-weight:800;font-family:'Fredoka One',sans-serif">${p}</td>
      <td style="font-size:10.5px;text-align:center;padding:11px 2px;border-bottom:1px solid rgba(58,53,96,0.06);color:#ff8c42;font-weight:800;font-family:'Fredoka One',sans-serif">${i}</td>
      <td style="font-size:10.5px;text-align:center;padding:11px 2px;border-bottom:1px solid rgba(58,53,96,0.06);color:#ff4f6d;font-weight:800;font-family:'Fredoka One',sans-serif">${a}</td>
      <td style="font-size:10.5px;text-align:center;padding:11px 2px;border-bottom:1px solid rgba(58,53,96,0.06)"><span style="background:rgba(167,139,250,0.18);color:#a78bfa;border-radius:12px;padding:3px 8px;font-family:'Fredoka One',sans-serif;font-size:10px">${pct}%</span></td>
    </tr>`;
  }).join('');

  const totalRecords = totalPresent+totalExcused+totalAbsent;
  const pctOf = n => totalRecords ? Math.round((n/totalRecords)*100) : 0;

  const dateHeaders = dates.map(d=>{
    const dd = new Date(d);
    const dayNum = String(dd.getDate()).padStart(2,'0');
    const dayName = dd.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase();
    return `<th style="${dateColWidth}font-weight:800;color:#3a3560;text-align:center">${dayNum}<br>${dayName}</th>`;
  }).join('');

  if(!students.length){
    return `<div style="font-family:'Baloo 2',sans-serif;padding:60px;text-align:center;color:#8b86a8">
      <div style="font-size:40px;margin-bottom:12px">📭</div>
      No attendance records found for ${monthLabel}.
    </div>`;
  }

  return `
  <div style="width:794px;min-height:1123px;box-sizing:border-box;padding:34px 49px 24px;
    font-family:'Baloo 2',sans-serif;color:#3a3560;position:relative;
    background:radial-gradient(circle at 8% 6%, rgba(108,99,255,0.07), transparent 22%),
               radial-gradient(circle at 94% 10%, rgba(255,101,132,0.07), transparent 24%),
               radial-gradient(circle at 90% 90%, rgba(0,201,167,0.06), transparent 26%),
               #fffaf3;">

    <div style="position:absolute;top:30px;left:295px;font-size:20px;opacity:0.55">⭐</div>
    <div style="position:absolute;top:22px;right:195px;font-size:20px;opacity:0.55;color:#ff6584">✨</div>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px">
      <div style="width:143px;height:143px;flex-shrink:0">
        <img src="icon-512.png" style="width:143px;height:143px;object-fit:contain">
      </div>

      <div style="flex:1;text-align:center;padding-top:8px">
        <div style="display:inline-block;background:linear-gradient(90deg,#00c9a7,#38bdf8);color:#fff;
          font-family:'Fredoka One',sans-serif;font-size:12px;letter-spacing:2px;padding:9px 34px;
          border-radius:11px;box-shadow:0 8px 16px rgba(56,189,248,0.35);margin-bottom:15px">LITTLELUME ENGLISH</div>
        <div style="font-family:'Fredoka One',sans-serif;font-size:36px;line-height:1.05">
          <span style="color:#a78bfa">ATTENDANCE</span> <span style="color:#ff6584">RECORD</span>
        </div>
        <div style="margin-top:15px">
          <span style="display:inline-block;font-family:'Fredoka One',sans-serif;font-size:15px;color:#00c9a7;
            border:2px dashed #00c9a7;padding:7px 30px;border-radius:11px;letter-spacing:1px">${monthLabel}</span>
        </div>
        <div style="margin-top:11px;font-size:13px;font-weight:700;opacity:0.8">${currentClassName || ''}</div>
      </div>

      <div style="width:106px;text-align:center;font-size:34px;line-height:1">📔
        <div style="font-size:8.5px;color:#8b86a8;font-weight:700;margin-top:6px">Keep<br>shining!</div>
      </div>
    </div>

    <div style="display:flex;gap:19px;margin-bottom:19px">
      <div style="flex:1;background:#fff;border-radius:15px;padding:19px 15px;display:flex;align-items:center;gap:13px;box-shadow:0 8px 16px rgba(58,53,96,0.06);border:1.5px solid rgba(58,53,96,0.06)">
        <div style="width:49px;height:49px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;background:linear-gradient(135deg,#a78bfa,#6c63ff)">📋</div>
        <div><div style="font-size:9px;font-weight:700;color:#8b86a8;text-transform:uppercase">Total Records</div><div style="font-family:'Fredoka One',sans-serif;font-size:22px">${totalRecords}</div><div style="font-size:9px;color:#8b86a8;font-weight:700">records</div></div>
      </div>
      <div style="flex:1;background:#fff;border-radius:15px;padding:19px 15px;display:flex;align-items:center;gap:13px;box-shadow:0 8px 16px rgba(58,53,96,0.06);border:1.5px solid rgba(58,53,96,0.06)">
        <div style="width:49px;height:49px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;background:linear-gradient(135deg,#00d68f,#00c9a7)">✓</div>
        <div><div style="font-size:9px;font-weight:700;color:#8b86a8;text-transform:uppercase">Present</div><div style="font-family:'Fredoka One',sans-serif;font-size:22px">${totalPresent}</div><div style="font-size:9px;color:#8b86a8;font-weight:700">${pctOf(totalPresent)}%</div></div>
      </div>
      <div style="flex:1;background:#fff;border-radius:15px;padding:19px 15px;display:flex;align-items:center;gap:13px;box-shadow:0 8px 16px rgba(58,53,96,0.06);border:1.5px solid rgba(58,53,96,0.06)">
        <div style="width:49px;height:49px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;background:linear-gradient(135deg,#ffb347,#ff8c42)">★</div>
        <div><div style="font-size:9px;font-weight:700;color:#8b86a8;text-transform:uppercase">Excused (Izin)</div><div style="font-family:'Fredoka One',sans-serif;font-size:22px">${totalExcused}</div><div style="font-size:9px;color:#8b86a8;font-weight:700">${pctOf(totalExcused)}%</div></div>
      </div>
      <div style="flex:1;background:#fff;border-radius:15px;padding:19px 15px;display:flex;align-items:center;gap:13px;box-shadow:0 8px 16px rgba(58,53,96,0.06);border:1.5px solid rgba(58,53,96,0.06)">
        <div style="width:49px;height:49px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;background:linear-gradient(135deg,#ff4f6d,#ff6584)">✕</div>
        <div><div style="font-size:9px;font-weight:700;color:#8b86a8;text-transform:uppercase">Absent</div><div style="font-family:'Fredoka One',sans-serif;font-size:22px">${totalAbsent}</div><div style="font-size:9px;color:#8b86a8;font-weight:700">${pctOf(totalAbsent)}%</div></div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:15px;overflow:hidden;box-shadow:0 8px 19px rgba(58,53,96,0.07);margin-bottom:19px">
      <thead>
        <tr style="background:linear-gradient(90deg,rgba(167,139,250,0.18),rgba(255,101,132,0.14))">
          <th colspan="2" style="padding:9px 2px"></th>
          <th colspan="${dates.length}" style="font-size:9px;font-weight:800;padding:9px 2px;color:#3a3560">DATE (${monthLabel})</th>
          <th colspan="4" style="padding:9px 2px"></th>
        </tr>
        <tr style="background:#f4f1fb;border-bottom:1.5px solid rgba(58,53,96,0.08)">
          <th style="font-size:8px;font-weight:800;color:#8b86a8;padding:8px 2px;text-transform:uppercase">No</th>
          <th style="font-size:8px;font-weight:800;color:#8b86a8;padding:8px 2px 8px 12px;text-transform:uppercase;text-align:left">Student Name</th>
          ${dateHeaders}
          <th style="font-size:8px;font-weight:800;color:#8b86a8;padding:8px 2px;text-transform:uppercase">Present</th>
          <th style="font-size:8px;font-weight:800;color:#8b86a8;padding:8px 2px;text-transform:uppercase">Excused</th>
          <th style="font-size:8px;font-weight:800;color:#8b86a8;padding:8px 2px;text-transform:uppercase">Absent</th>
          <th style="font-size:8px;font-weight:800;color:#8b86a8;padding:8px 2px;text-transform:uppercase">Att. %</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex;gap:19px;margin-bottom:19px">
      <div style="flex:1;background:#fff;border-radius:13px;padding:17px;box-shadow:0 6px 11px rgba(58,53,96,0.06)">
        <div style="display:inline-block;font-family:'Fredoka One',sans-serif;font-size:9px;padding:5px 13px;border-radius:9px;margin-bottom:11px;background:rgba(0,201,167,0.15);color:#00c9a7">LEGEND</div>
        <div style="display:flex;align-items:center;gap:9px;font-size:9.5px;margin-bottom:7px;font-weight:600"><span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#00d68f;color:#fff;align-items:center;justify-content:center;font-size:9px">✓</span> Present (Hadir)</div>
        <div style="display:flex;align-items:center;gap:9px;font-size:9.5px;margin-bottom:7px;font-weight:600"><span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#ffb347;color:#fff;align-items:center;justify-content:center;font-size:9px">I</span> Excused (Izin)</div>
        <div style="display:flex;align-items:center;gap:9px;font-size:9.5px;font-weight:600"><span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#ff4f6d;color:#fff;align-items:center;justify-content:center;font-size:9px">✕</span> Absent (Alpha)</div>
      </div>
      <div style="flex:1;background:#fff;border-radius:13px;padding:17px;box-shadow:0 6px 11px rgba(58,53,96,0.06)">
        <div style="display:inline-block;font-family:'Fredoka One',sans-serif;font-size:9px;padding:5px 13px;border-radius:9px;margin-bottom:11px;background:rgba(167,139,250,0.18);color:#a78bfa">NOTE</div>
        <div style="font-size:9.5px;line-height:1.7;font-weight:600">– = No session scheduled that date<br>Attendance % = Present / Total sessions</div>
      </div>
      <div style="flex:1;background:#fff;border-radius:13px;padding:17px;box-shadow:0 6px 11px rgba(58,53,96,0.06)">
        <div style="display:inline-block;font-family:'Fredoka One',sans-serif;font-size:9px;padding:5px 13px;border-radius:9px;margin-bottom:11px;background:rgba(255,101,132,0.15);color:#ff6584">REMINDER</div>
        <div style="font-size:9.5px;line-height:1.7;font-weight:600">Let's come to class on time, be present, and make every lesson count!</div>
      </div>
    </div>

    <div style="text-align:center;margin-top:19px">
      <span style="background:#fff;border:2px dashed #a78bfa;border-radius:15px;padding:9px 26px;font-family:'Fredoka One',sans-serif;font-size:12px;color:#a78bfa">✨ Thank you for being awesome every day! ✨</span>
    </div>
    <div style="text-align:center;font-size:9px;color:#8b86a8;font-weight:700;margin-top:15px">Generated by LittleLume English Course · Attendance Management System</div>
  </div>`;
}

async function _renderAttReportCanvas(monthStr){
  const panel = document.getElementById('att-report-render-panel');
  panel.innerHTML = _buildAttReportHTML(monthStr);

  // pastikan gambar logo selesai dimuat sebelum di-capture
  const imgs = panel.querySelectorAll('img');
  await Promise.all([...imgs].map(img=>
    img.complete ? Promise.resolve() : new Promise(res=>{ img.onload=res; img.onerror=res; })
  ));
  await new Promise(r=>setTimeout(r,200));

  const canvas = await html2canvas(panel, {
    scale:2,
    useCORS:true,
    backgroundColor:'#ffffff',
    width:794,
    windowWidth:794,
    logging:false
  });
  panel.innerHTML='';
  return canvas;
}

async function exportAttReport(type){
  const monthStr = document.getElementById('att-report-month').value;
  if(!monthStr){ showToast('Please select a month','warning'); return; }
  const safeMonth = monthStr;
  const safeClass = (currentClassName||'class').replace(/\s+/g,'-');

  if(type==='png'){
    showToast('Generating PNG…','info',2500);
    const canvas = await _renderAttReportCanvas(monthStr);
    const a = document.createElement('a');
    a.download = `attendance-report-${safeClass}-${safeMonth}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('PNG downloaded!','success');

  } else if(type==='pdf'){
    showToast('Generating PDF…','info',2500);
    const canvas = await _renderAttReportCanvas(monthStr);
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pxW = canvas.width / 2;
    const pxH = canvas.height / 2;
    const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:[pxW, pxH], hotfixes:['px_scaling'] });
    pdf.addImage(imgData,'PNG',0,0,pxW,pxH);
    pdf.save(`attendance-report-${safeClass}-${safeMonth}.pdf`);
    showToast('PDF downloaded!','success');
  }
  closeModal('modal-att-report');
}

// ════════════════════════════════════════════════
