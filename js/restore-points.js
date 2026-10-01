// ════════════════════════════════════════════════
//  RESTORE POINTS — salinan otomatis data kelas
// ────────────────────────────────────────────────
//  • Otomatis: 1x per hari per kelas, berisi data SEBELUM perubahan pertama hari itu.
//    Disimpan 14 hari terakhir.
//  • Manual  : tombol "Create now" (disimpan 10 terakhir), dan otomatis sebelum restore.
//  Penyimpanan (tanpa ubah Security Rules — semua masih di koleksi workspace):
//    workspace/{classId}__rp_index        → daftar restore point (metadata saja)
//    workspace/{classId}__rp_{pointId}    → isi data (JSON string, 1 dokumen per point)
// ════════════════════════════════════════════════
const RP_KEEP_AUTO_DAYS = 14;
const RP_KEEP_MANUAL    = 10;

const _rpIndexRef = cid => db.collection('workspace').doc(cid + '__rp_index');
const _rpDocRef   = (cid, id) => db.collection('workspace').doc(cid + '__rp_' + id);

let _rpIndexCache = {};     // classId → [points]
let _rpDoneKey    = null;   // 'classId|YYYYMMDD' → restore point harian sudah dipastikan ada
let _rpBusy       = false;

function _rpCounts(d){
  return { siswa:(d.siswa||[]).length, absensi:(d.absensi||[]).length, bayar:(d.bayar||[]).length,
           deposits:(d.deposits||[]).length, evaluasi:(d.evaluasi||[]).length, materi:(d.materi||[]).length };
}
function _rpTotal(c){ return Object.values(c).reduce((a,b)=>a+b,0); }

async function _rpGetIndex(cid, fresh){
  if(!fresh && _rpIndexCache[cid]) return _rpIndexCache[cid];
  const snap = await _rpIndexRef(cid).get();
  const points = snap.exists && Array.isArray(snap.data().points) ? snap.data().points : [];
  _rpIndexCache[cid] = points;
  return points;
}
async function _rpSaveIndex(cid, points){
  points.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  await _rpIndexRef(cid).set({ points, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  _rpIndexCache[cid] = points;
}

// Tulis satu restore point. type: 'auto' | 'manual' | 'before-restore'
async function _rpWrite(cid, id, type, data, label){
  const clean = {};
  COLS.forEach(k=>{ clean[k] = Array.isArray(data[k]) ? data[k] : []; });
  const json = JSON.stringify(clean);
  const bytes = new TextEncoder().encode(json).length;
  if(bytes > 1000000) throw new Error('Class data too large for a restore point ('+Math.round(bytes/1024)+' KB)');
  const meta = { id, type, label: label||'', createdAt: new Date().toISOString(),
                 counts: _rpCounts(clean), bytes,
                 appVersion: (typeof APP_VERSION!=='undefined' ? APP_VERSION : null) };
  await _rpDocRef(cid, id).set({ ...meta, classId: cid, data: json });
  const points = (await _rpGetIndex(cid, true)).filter(p=>p.id!==id);
  points.push(meta);
  await _rpSaveIndex(cid, points);
  await _rpPrune(cid);
  return meta;
}

// Hapus yang sudah lewat masa simpan
async function _rpPrune(cid){
  const points = await _rpGetIndex(cid);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - RP_KEEP_AUTO_DAYS);
  const cutoffKey = todayISO(cutoff).replace(/-/g,'');
  const manual = points.filter(p=>p.type!=='auto');   // sudah urut terbaru dulu
  const drop = [
    ...points.filter(p=>p.type==='auto' && p.id < cutoffKey),
    ...manual.slice(RP_KEEP_MANUAL),
  ];
  if(!drop.length) return;
  const dropIds = new Set(drop.map(p=>p.id));
  await Promise.all(drop.map(p=>_rpDocRef(cid, p.id).delete().catch(()=>{})));
  await _rpSaveIndex(cid, points.filter(p=>!dropIds.has(p.id)));
}

// ── Otomatis: pastikan restore point hari ini ada ──
// Dipanggil setelah data kelas dimuat & sebelum setiap penyimpanan.
// Isinya _base = data terakhir yang sama dengan server (sebelum edit yang sedang berjalan).
async function rpEnsureDaily(){
  if(!_loadOk || !currentClassId || !_base || _rpBusy) return;
  const cid = currentClassId, today = todayISO().replace(/-/g,'');
  const key = cid + '|' + today;
  if(_rpDoneKey === key) return;
  _rpBusy = true;
  try{
    const data = _clone(_base);
    const points = await _rpGetIndex(cid, true);
    if(!points.some(p=>p.id===today) && _rpTotal(_rpCounts(data)) > 0){
      await _rpWrite(cid, today, 'auto', data, 'Daily');
      console.log('🕒 Restore point created: '+today);
    }
    _rpDoneKey = key;
    if(document.getElementById('page-backup')?.classList.contains('active')) renderRestorePoints();
  }catch(e){
    console.warn('Restore point skipped:', e.message);
  }finally{
    _rpBusy = false;
  }
}

// ── Manual ──
async function rpCreateManual(){
  if(!_loadOk){ showToast('Data not loaded yet','warn'); return; }
  try{
    const meta = await _rpWrite(currentClassId, 'm' + Date.now(), 'manual', _clone(_currentData()), 'Manual');
    showToast('🕒 Restore point created ('+_rpTotal(meta.counts)+' records)','success');
    renderRestorePoints();
  }catch(e){
    showToast('❌ Failed to create restore point: '+(e.message||e.code),'error',6000);
  }
}

// ── Restore ──
function rpRestore(id){
  const cid = currentClassId;
  const p = (_rpIndexCache[cid]||[]).find(x=>x.id===id); if(!p) return;
  const c = p.counts||{};
  dangerModal(
    '🕒 Restore This Point?',
    `Restore <strong>${esc(currentClassName)}</strong> to <strong>${_rpWhen(p)}</strong>:` +
    `<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;margin:10px 0;text-align:left;line-height:1.9;font-size:0.85rem">
       👤 ${c.siswa||0} students · 📋 ${c.absensi||0} attendance · 💰 ${c.bayar||0} payments · 🏦 ${c.deposits||0} deposits · ⭐ ${c.evaluasi||0} evaluations
     </div>` +
    `<p style="color:var(--red);font-weight:700">All current data in this class will be replaced.</p>` +
    `<p style="font-size:0.8rem;color:var(--muted)">The current data is saved as a restore point first, so this can be undone.</p>`,
    async ()=>{
      try{
        showToast('⏳ Restoring…','info',2500);
        const snap = await _rpDocRef(cid, id).get();
        if(!snap.exists) throw new Error('restore point not found');
        const data = _dataFromDoc(JSON.parse(snap.data().data));
        if(currentClassId !== cid) throw new Error('class changed');
        // Pengaman: simpan kondisi sekarang dulu
        await _rpWrite(cid, 'm' + Date.now(), 'before-restore', _clone(_currentData()), 'Before restoring ' + _rpWhen(p));
        _setLists(_clone(data));
        await _flushToFirestore({ force:true });
        renderAll(); setCurrentMonthDashFilter(); loadAbsensi();
        renderRestorePoints();
        showToast('✅ Restored to '+_rpWhen(p),'success',4000);
      }catch(e){
        console.error('Restore point error:', e);
        showToast('❌ Restore failed: '+(e.message||e.code),'error',7000);
      }
    },
    { okText:'Restore' }
  );
}

// ── Download sebagai file backup biasa (bisa di-Restore Backup) ──
async function rpDownload(id){
  const cid = currentClassId;
  try{
    const snap = await _rpDocRef(cid, id).get();
    if(!snap.exists) throw new Error('not found');
    const d = snap.data();
    const out = { ..._dataFromDoc(JSON.parse(d.data)), className: currentClassName, classId: cid,
                  exportedAt: d.createdAt, appVersion: d.appVersion, restorePoint: id };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
    a.download = 'LittleLume-'+(currentClassName||'Class').replace(/[^a-z0-9]+/gi,'-')+'-RestorePoint-'+(d.createdAt||'').slice(0,10)+'.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 10000);
  }catch(e){
    showToast('❌ Download failed: '+(e.message||e.code),'error');
  }
}

function rpDelete(id){
  const cid = currentClassId;
  const p = (_rpIndexCache[cid]||[]).find(x=>x.id===id); if(!p) return;
  dangerModal('Delete Restore Point?', `Delete the restore point from <strong>${_rpWhen(p)}</strong>?`, async ()=>{
    try{
      await _rpDocRef(cid, id).delete();
      await _rpSaveIndex(cid, (await _rpGetIndex(cid, true)).filter(x=>x.id!==id));
      renderRestorePoints();
      showToast('🗑️ Restore point deleted','success');
    }catch(e){ showToast('❌ '+(e.message||e.code),'error'); }
  });
}

// Hapus semua restore point milik kelas (dipakai saat kelas dihapus)
async function rpDeleteAllForClass(cid){
  try{
    const points = await _rpGetIndex(cid, true);
    await Promise.all(points.map(p=>_rpDocRef(cid, p.id).delete().catch(()=>{})));
    await _rpIndexRef(cid).delete();
    delete _rpIndexCache[cid];
  }catch(e){ console.warn('rpDeleteAllForClass:', e.message); }
}

// ── UI ──
function _rpWhen(p){
  const d = new Date(p.createdAt);
  return d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}) +
         ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
const _RP_TYPE = {
  'auto':           { label:'Daily',          color:'var(--accent)', bg:'rgba(108,99,255,0.13)' },
  'manual':         { label:'Manual',         color:'var(--green)',  bg:'rgba(67,233,123,0.13)' },
  'before-restore': { label:'Before restore', color:'var(--yellow)', bg:'rgba(255,179,71,0.15)' },
};

async function renderRestorePoints(){
  const el = document.getElementById('rp-panel'); if(!el) return;
  if(!currentClassId){ el.innerHTML=''; return; }
  const cid = currentClassId;
  if(!_rpIndexCache[cid]) el.innerHTML = '<span style="color:var(--muted);font-size:0.85rem">Loading…</span>';
  let points;
  try{ points = await _rpGetIndex(cid); }
  catch(e){ el.innerHTML = `<span style="color:var(--red);font-size:0.85rem">❌ Could not load restore points (${esc(e.code||e.message)}).</span>`; return; }
  if(cid !== currentClassId) return;
  if(!points.length){
    el.innerHTML = '<div style="color:var(--muted);font-size:0.85rem">No restore points yet. The first one is created automatically today, or click <b>Create now</b>.</div>';
    return;
  }
  const totalKB = Math.round(points.reduce((t,p)=>t+(p.bytes||0),0)/1024);
  el.innerHTML = points.map(p=>{
    const t = _RP_TYPE[p.type] || _RP_TYPE.manual, c = p.counts||{};
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div style="min-width:0">
        <div style="font-weight:700;font-size:0.9rem;color:var(--text)">
          ${_rpWhen(p)}
          <span style="font-size:0.62rem;font-weight:800;color:${t.color};background:${t.bg};padding:2px 7px;border-radius:8px;margin-left:6px;vertical-align:middle">${t.label}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">
          ${p.type==='before-restore' ? esc(p.label)+' · ' : ''}👤 ${c.siswa||0} · 📋 ${c.absensi||0} · 💰 ${c.bayar||0} · 🏦 ${c.deposits||0} · ⭐ ${c.evaluasi||0}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn primary sm" onclick="rpRestore('${p.id}')">↩️ Restore</button>
        <button class="btn sm" onclick="rpDownload('${p.id}')" title="Download as backup file">⬇️</button>
        <button class="btn danger sm" onclick="rpDelete('${p.id}')" title="Delete">🗑️</button>
      </div>
    </div>`;
  }).join('') + `<div style="font-size:0.72rem;color:var(--muted);margin-top:8px">${points.length} restore point${points.length>1?'s':''} · ${totalKB} KB stored</div>`;
}
