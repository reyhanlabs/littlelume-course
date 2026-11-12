// ════════════════════════════════════════════════
//  KURIKULUM LITTLELUME — per grade & semester
// ────────────────────────────────────────────────
//  Data: curriculum/curriculum.json (dari halaman Curriculum LittleLume), dimuat
//  hanya saat halaman Lessons dibuka. Tidak disimpan di Firestore.
//  Setiap kelas punya setelan { grade, semester } di classesList[].curriculum.
//  Lesson yang dibuat dari kurikulum menyimpan kunci: kurikulum = "grade|semester|index".
//  Editan guru disimpan di Firestore workspace/curriculum_edits (berlaku untuk semua
//  kelas) dan ditimpakan di atas JSON asli; "Reset" mengembalikan ke versi asli.
// ════════════════════════════════════════════════
const CUR_GRADES = { kindergarten:'Kindergarten', grade1:'Grade 1', grade3:'Grade 3', grade4:'Grade 4' };
const CUR_URL = 'curriculum/curriculum.json';

let _curData = null, _curLoading = null;
let _curOrig = null;            // JSON asli (tanpa editan)
let _curEdits = { meetings:{} }; // { meetings: { "grade|sem|idx": {...field yang diubah} } }
const CUR_EDIT_DOC = 'curriculum_edits';
const CUR_EDIT_FIELDS = ['title','duration','objectives','grammarPattern','grammarExample','grammarNote','grammarCorner','pronunciation','readingWriting','vocab','media','activities','assessment'];

function curLoad(){
  if(_curData) return Promise.resolve(_curData);
  if(!_curLoading){
    const edits = (typeof db!=='undefined' ? db.collection('workspace').doc(CUR_EDIT_DOC).get().then(d=>d.exists?d.data():null).catch(e=>{ console.warn('curriculum edits', e); return null; }) : Promise.resolve(null));
    _curLoading = Promise.all([
      fetch(CUR_URL, { cache:'no-cache' }).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }),
      edits,
    ]).then(([j, e])=>{
        _curOrig = j;
        _curEdits = { meetings: (e && e.meetings) || {} };
        _curData = _curApplyEdits(j, _curEdits);
        return _curData;
      })
      .finally(()=>{ _curLoading = null; });
  }
  return _curLoading;
}
// Timpakan editan di atas data asli (salinan baru, data asli tidak diubah)
function _curApplyEdits(orig, edits){
  const out = JSON.parse(JSON.stringify(orig));
  Object.entries(edits.meetings||{}).forEach(([key, ch])=>{
    const p = curParseKey(key); if(!p) return;
    const m = out?.[p.grade]?.['semester'+p.sem]?.meetings?.[p.idx];
    if(m && ch) Object.assign(m, ch);
  });
  return out;
}
function curIsEdited(key){ return !!(_curEdits.meetings||{})[key]; }

// Tebak grade dari nama kelas ("Grade 3", "Kelas 1", "TK", "Kindergarten")
function curGuessGrade(name){
  const n = String(name||'').toLowerCase();
  if(/kinder|\btk\b|paud|\bkg\b/.test(n)) return 'kindergarten';
  const m = n.match(/(?:grade|kelas|class|g)\s*-?\s*(\d)/);
  if(m && CUR_GRADES['grade'+m[1]]) return 'grade'+m[1];
  return '';
}
// Semester 1 = Juli–Desember, Semester 2 = Januari–Juni (tahun ajaran Indonesia)
function curGuessSemester(){ return (new Date().getMonth()+1) >= 7 ? 1 : 2; }

function curSetting(){
  const cls = classesList.find(c=>c.id===currentClassId);
  const saved = cls?.curriculum;
  return {
    grade:    saved ? (saved.grade||'') : curGuessGrade(cls?.name),
    semester: saved?.semester || curGuessSemester(),
    saved:    !!saved,
  };
}
async function curSaveSetting(grade, semester){
  const cls = classesList.find(c=>c.id===currentClassId); if(!cls) return;
  cls.curriculum = { grade: grade||'', semester: +semester||1 };
  try{ await saveClassesList(); }catch(e){ showToast('❌ Could not save class setting','error'); }
  renderCurriculum();
}

function curKey(grade, sem, idx){ return `${grade}|${sem}|${idx}`; }
function curParseKey(k){
  const [grade, sem, idx] = String(k||'').split('|');
  return grade ? { grade, sem:+sem, idx:+idx } : null;
}
function curGetSem(grade, sem){ return _curData?.[grade]?.['semester'+sem] || null; }
function curGetMeeting(key){
  const p = curParseKey(key); if(!p) return null;
  const s = curGetSem(p.grade, p.sem);
  const m = s?.meetings?.[p.idx];
  return m ? { ...p, m, sem:p.sem, semData:s } : null;
}
function curLabel(key){
  const p = curParseKey(key); if(!p) return '';
  const m = curGetMeeting(key);
  return `${CUR_GRADES[p.grade]||p.grade} · S${p.sem} · ${m ? m.m.num : 'Session '+(p.idx+1)}`;
}

// ── Panel di halaman Lessons ──
async function renderCurriculum(){
  const el = document.getElementById('cur-panel'); if(!el) return;
  const st = curSetting();
  const gradeOpts = `<option value="">— No curriculum —</option>` +
    Object.entries(CUR_GRADES).map(([k,v])=>`<option value="${k}" ${k===st.grade?'selected':''}>${v}</option>`).join('');
  const semOpts = [1,2].map(s=>`<option value="${s}" ${s===st.semester?'selected':''}>Semester ${s}</option>`).join('');
  const head = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <div style="font-family:'Fredoka One',sans-serif;font-weight:800;color:var(--accent)">📚 LittleLume Curriculum</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="cur-grade" style="width:auto" onchange="curSaveSetting(this.value, document.getElementById('cur-sem').value)">${gradeOpts}</select>
        <select id="cur-sem" style="width:auto" onchange="curSaveSetting(document.getElementById('cur-grade').value, this.value)">${semOpts}</select>
      </div>
    </div>`;

  if(!st.grade){
    el.innerHTML = head + `<div style="color:var(--muted);font-size:0.85rem">Choose this class's grade to show its curriculum sessions here.</div>`;
    return;
  }
  if(!_curData) el.innerHTML = head + `<div style="color:var(--muted);font-size:0.85rem">⏳ Loading curriculum…</div>`;
  try{ await curLoad(); }
  catch(e){ el.innerHTML = head + `<div style="color:var(--red);font-size:0.85rem">❌ Could not load curriculum (${esc(e.message)}).</div>`; return; }

  const semData = curGetSem(st.grade, st.semester);
  if(!semData){ el.innerHTML = head + `<div style="color:var(--muted);font-size:0.85rem">No curriculum for this grade/semester yet.</div>`; return; }

  // Lesson yang terhubung ke tiap sesi
  const linked = {};
  materiList.forEach(m=>{
    const p = curParseKey(m.kurikulum);
    if(p && p.grade===st.grade && p.sem===st.semester) (linked[p.idx] = linked[p.idx]||[]).push(m);
  });
  const meetings = semData.meetings || [];
  const doneCount = meetings.filter((_,i)=>(linked[i]||[]).some(l=>l.status==='Selesai')).length;
  const nextIdx = meetings.findIndex((_,i)=>!(linked[i]||[]).length);
  const pct = meetings.length ? Math.round(doneCount/meetings.length*100) : 0;
  const ov = semData.overview || {};
  const savedNote = st.saved ? '' : `<div style="font-size:0.75rem;color:var(--yellow);margin-bottom:8px">💡 Guessed from the class name — change it above if needed (it will be saved for this class).</div>`;

  el.innerHTML = head + savedNote + `
    <div style="font-size:0.8rem;color:var(--muted);margin-bottom:8px">${esc(ov.jenjang||'')}${ov.durasi?' · '+esc(ov.durasi):''}${ov.jumlahPertemuan?' · '+esc(ov.jumlahPertemuan):''}
      · <a href="javascript:void(0)" onclick="curShowOverview()" style="color:var(--accent);font-weight:700">Overview & learning goals</a></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="flex:1;height:8px;background:var(--bg3);border-radius:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--green)"></div></div>
      <div style="font-size:0.8rem;font-weight:700;white-space:nowrap">${doneCount}/${meetings.length} taught</div>
    </div>
    <div style="max-height:440px;overflow-y:auto;padding-right:4px">
      ${meetings.map((m,i)=>{
        const ls = (linked[i]||[]).sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||''));
        const done = ls.find(l=>l.status==='Selesai'), plan = ls.find(l=>l.status!=='Selesai');
        const status = done ? `<span class="chip chip-green" style="font-size:0.68rem">✅ Taught ${tglFmt(done.tanggal)}</span>`
                     : plan ? `<span class="chip chip-purple" style="font-size:0.68rem">📅 Planned ${tglFmt(plan.tanggal)}</span>`
                     : i===nextIdx ? `<span class="chip chip-yellow" style="font-size:0.68rem">⭐ Next</span>` : '';
        const key = curKey(st.grade, st.semester, i);
        const action = ls.length
          ? `<button class="btn sm" onclick="openEditLesson('${ls[ls.length-1].id}')" title="Open lesson">✏️</button>`
          : `<button class="btn primary sm" onclick="curAddLesson('${key}')" title="Add to lessons">➕ Plan</button>`;
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);${done?'opacity:0.75':''}">
          <div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.78rem;background:${done?'rgba(0,214,143,0.15)':'var(--bg3)'};color:${done?'var(--green)':'var(--text)'}">${i+1}</div>
          <div style="flex:1;min-width:0;cursor:pointer" onclick="curShowMeeting('${key}')">
            <div style="font-weight:700;font-size:0.88rem">${esc(m.title)} ${status}${curIsEdited(key)?' <span class="chip chip-muted" style="font-size:0.66rem" title="Edited by you">✏️ Edited</span>':''}</div>
            <div style="font-size:0.75rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.grammarPattern||'')}${m.vocab?.length?' · '+esc(m.vocab.slice(0,6).join(', '))+(m.vocab.length>6?'…':''):''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn sm" onclick="curShowMeeting('${key}')" title="View lesson plan">👁</button>
            ${action}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ── Modal ──
function _curModal(id, title, body, footer){
  document.getElementById(id)?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="overlay open" id="${id}" onclick="if(event.target===this) closeModalDialog('${id}')">
      <div class="modal" style="max-width:640px">
        <button class="modal-x" onclick="closeModalDialog('${id}')" title="Close">✕</button>
        <div class="modal-title modal-head-pad">${title}</div>
        <div style="max-height:62vh;overflow-y:auto;padding-right:4px;text-align:left">${body}</div>
        ${footer}
      </div>
    </div>`);
}
const _curSec = (t, html) => `<div style="margin:14px 0 6px;font-weight:800;font-size:0.8rem;letter-spacing:.3px;color:var(--accent);text-transform:uppercase">${t}</div>${html}`;
const _curList = arr => `<ul style="margin:0;padding-left:18px;font-size:0.86rem;line-height:1.55">${(arr||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const _curChips = arr => `<div style="display:flex;flex-wrap:wrap;gap:5px">${(arr||[]).map(x=>`<span class="chip chip-muted" style="font-size:0.75rem">${esc(x)}</span>`).join('')}</div>`;

function _curMeetingBody(m){
  return `
    ${_curSec('Objectives', _curList(m.objectives))}
    ${_curSec('Grammar', `<div style="background:var(--bg3);border-radius:8px;padding:10px 12px;font-size:0.86rem;line-height:1.5">
        <div><b>Pattern:</b> ${esc(m.grammarPattern)}</div>
        ${m.grammarExample?`<div><b>Example:</b> <i>${esc(m.grammarExample)}</i></div>`:''}
        ${m.grammarNote?`<div style="color:var(--muted);margin-top:4px">${esc(m.grammarNote)}</div>`:''}
        ${m.grammarCorner?`<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)">✏️ <b>Grammar Corner:</b> ${esc(m.grammarCorner)}</div>`:''}
      </div>`)}
    ${m.pronunciation||m.readingWriting ? _curSec('Pronunciation & Reading', `<div style="background:var(--bg3);border-radius:8px;padding:10px 12px;font-size:0.86rem;line-height:1.5">
        ${m.pronunciation?`<div>🔊 <b>Pronunciation Drill:</b> ${esc(m.pronunciation)}</div>`:''}
        ${m.readingWriting?`<div ${m.pronunciation?'style="margin-top:4px"':''}>📖 <b>Reading & Writing:</b> ${esc(m.readingWriting)}</div>`:''}
      </div>`) : ''}
    ${_curSec('Vocabulary', _curChips(m.vocab))}
    ${_curSec('Media', _curList(m.media))}
    ${_curSec('Activities', `<div class="tbl-wrap"><table style="font-size:0.82rem">
        <thead><tr><th style="width:52px">Time</th><th style="width:130px">Activity</th><th>Description</th></tr></thead>
        <tbody>${(m.activities||[]).map(a=>`<tr><td>${esc(a.waktu)}</td><td><b>${esc(a.kegiatan)}</b></td><td>${esc(a.deskripsi)}</td></tr>`).join('')}</tbody>
      </table></div>`)}
    ${_curSec('Assessment', _curList(m.assessment))}`;
}

function curShowMeeting(key){
  const r = curGetMeeting(key); if(!r) return;
  const linkedLesson = materiList.find(l=>l.kurikulum===key);
  _curModal('modal-cur-meeting',
    `📚 ${esc(r.m.num)}: ${esc(r.m.title)}`,
    `<div style="font-size:0.78rem;color:var(--muted)">${esc(CUR_GRADES[r.grade]||r.grade)} · Semester ${r.sem} · ${esc(r.m.duration||'')}</div>` + _curMeetingBody(r.m),
    shareBarHTML({
      primary: linkedLesson
        ? ['✏️','Open lesson',`closeModalDialog('modal-cur-meeting');openEditLesson('${linkedLesson.id}')`]
        : ['➕','Add to lessons',`closeModalDialog('modal-cur-meeting');curAddLesson('${key}')`],
      print:`curPrintMeeting('${key}')`,
      more:[
        ['✏️','Edit this session',`closeModalDialog('modal-cur-meeting');curEditMeeting('${key}')`],
        curIsEdited(key) ? ['↩️','Reset to original',`closeModalDialog('modal-cur-meeting');curResetMeeting('${key}')`] : null,
      ],
    }));
  // Tombol edit juga langsung terlihat di judul modal
  const t = document.querySelector('#modal-cur-meeting .modal-title');
  if(t) t.insertAdjacentHTML('beforeend', ` <button class="btn sm" style="margin-left:6px;vertical-align:middle" onclick="closeModalDialog('modal-cur-meeting');curEditMeeting('${key}')">✏️ Edit</button>${curIsEdited(key)?' <span class="chip chip-muted" style="font-size:0.66rem;vertical-align:middle">Edited</span>':''}`);
}

// ════════════════════════════════════════════════
//  EDIT SESI KURIKULUM
// ════════════════════════════════════════════════
function curEditMeeting(key){
  const r = curGetMeeting(key); if(!r) return;
  const m = r.m;
  const lines = a => esc((a||[]).join('\n'));
  const fld = (id, label, val, ph, hint) => `<div class="form-group"><label>${label}${hint?` <small style="font-weight:500;color:var(--muted);text-transform:none">${hint}</small>`:''}</label><input type="text" id="ce-${id}" value="${esc(val||'')}" placeholder="${ph||''}"></div>`;
  const area = (id, label, val, rows, hint) => `<div class="form-group"><label>${label}${hint?` <small style="font-weight:500;color:var(--muted);text-transform:none">${hint}</small>`:''}</label><textarea id="ce-${id}" rows="${rows||3}">${val||''}</textarea></div>`;
  const used = materiList.filter(l=>l.kurikulum===key).length;
  _curModal('modal-cur-edit', `✏️ Edit ${esc(m.num)}`, `
    <div style="font-size:0.78rem;color:var(--muted);margin-bottom:10px">${esc(CUR_GRADES[r.grade]||r.grade)} · Semester ${r.sem} · changes apply to <b>every class</b> using this curriculum.${used?` Lessons already created from this session (${used}) keep their own text.`:''}</div>
    <div class="form-row">${fld('title','Title',m.title)}${fld('duration','Duration',m.duration,'60 minutes')}</div>
    ${area('objectives','Objectives',lines(m.objectives),4,'(one per line)')}
    <div class="form-row">${fld('grammarPattern','Grammar pattern',m.grammarPattern)}${fld('grammarExample','Grammar example',m.grammarExample)}</div>
    ${area('grammarNote','Grammar note',esc(m.grammarNote||''),2)}
    ${area('grammarCorner','Grammar Corner',esc(m.grammarCorner||''),2)}
    <div class="form-row">${area('pronunciation','Pronunciation drill',esc(m.pronunciation||''),2)}${area('readingWriting','Reading & writing',esc(m.readingWriting||''),2)}</div>
    ${area('vocab','Vocabulary',esc((m.vocab||[]).join(', ')),2,'(separate with commas)')}
    ${area('media','Media',lines(m.media),3,'(one per line)')}
    <div class="form-group"><label>Activities</label>
      <div id="ce-acts" class="ce-acts">${(m.activities||[]).map(_curActRow).join('')}</div>
      <button type="button" class="btn sm" style="margin-top:6px" onclick="document.getElementById('ce-acts').insertAdjacentHTML('beforeend', _curActRow({}))">＋ Add activity</button>
    </div>
    ${area('assessment','Assessment',lines(m.assessment),3,'(one per line)')}
  `, `<div class="btn-row" style="margin-top:14px;flex-wrap:wrap">
      <button class="btn primary" onclick="curSaveMeeting('${key}')">💾 Save changes</button>
      ${curIsEdited(key)?`<button class="btn" onclick="closeModalDialog('modal-cur-edit');curResetMeeting('${key}')">↩️ Reset to original</button>`:''}
      <button class="btn" onclick="closeModalDialog('modal-cur-edit');curShowMeeting('${key}')">Cancel</button>
    </div>`);
}
function _curActRow(a){
  return `<div class="ce-act">
    <input type="text" class="ce-a-w" value="${esc(a.waktu||'')}" placeholder="5'" title="Time">
    <input type="text" class="ce-a-k" value="${esc(a.kegiatan||'')}" placeholder="Activity">
    <textarea class="ce-a-d" rows="2" placeholder="Description">${esc(a.deskripsi||'')}</textarea>
    <div class="ce-a-btns">
      <button type="button" class="btn sm icon-only" title="Move up" onclick="const r=this.closest('.ce-act'); r.previousElementSibling && r.parentNode.insertBefore(r, r.previousElementSibling)">↑</button>
      <button type="button" class="btn danger sm icon-only" title="Remove" onclick="this.closest('.ce-act').remove()">✕</button>
    </div>
  </div>`;
}
async function curSaveMeeting(key){
  const p = curParseKey(key); const orig = _curOrig?.[p.grade]?.['semester'+p.sem]?.meetings?.[p.idx];
  if(!orig){ showToast('Session not found','error'); return; }
  const v = id => (document.getElementById('ce-'+id)?.value||'').trim();
  const lines = id => v(id).split('\n').map(x=>x.replace(/^[-•*]\s*/,'').trim()).filter(Boolean);
  const next = {
    title: v('title'), duration: v('duration'),
    objectives: lines('objectives'),
    grammarPattern: v('grammarPattern'), grammarExample: v('grammarExample'), grammarNote: v('grammarNote'),
    grammarCorner: v('grammarCorner'), pronunciation: v('pronunciation'), readingWriting: v('readingWriting'),
    vocab: v('vocab').split(/[,\n]/).map(x=>x.trim()).filter(Boolean),
    media: lines('media'),
    activities: [...document.querySelectorAll('#ce-acts .ce-act')].map(r=>({
      waktu: r.querySelector('.ce-a-w').value.trim(), kegiatan: r.querySelector('.ce-a-k').value.trim(), deskripsi: r.querySelector('.ce-a-d').value.trim(),
    })).filter(a=>a.waktu||a.kegiatan||a.deskripsi),
    assessment: lines('assessment'),
  };
  if(!next.title){ showToast('Title is required','warn'); return; }
  // Simpan hanya field yang berbeda dari versi asli
  const diff = {};
  CUR_EDIT_FIELDS.forEach(f=>{
    const o = orig[f] ?? (Array.isArray(next[f]) ? [] : '');
    if(JSON.stringify(o) !== JSON.stringify(next[f])) diff[f] = next[f];
  });
  const meetings = { ...(_curEdits.meetings||{}) };
  if(Object.keys(diff).length) meetings[key] = diff; else delete meetings[key];
  try{
    await _curWriteEdits(meetings);
    closeModalDialog('modal-cur-edit');
    showToast(Object.keys(diff).length ? '✅ Session updated' : 'No changes — session matches the original', 'success');
    renderCurriculum(); curShowMeeting(key);
  }catch(e){ console.error(e); showToast('❌ Could not save: '+(e.message||e),'error',6000); }
}
function curResetMeeting(key){
  confirmModal('↩️ Reset to original', 'Undo all your changes to this session and go back to the original curriculum text?', async ()=>{
    const meetings = { ...(_curEdits.meetings||{}) }; delete meetings[key];
    try{ await _curWriteEdits(meetings); showToast('↩️ Session reset to original','success'); renderCurriculum(); curShowMeeting(key); }
    catch(e){ showToast('❌ Could not reset: '+(e.message||e),'error',6000); }
  }, { okText:'Reset' });
}
async function _curWriteEdits(meetings){
  await db.collection('workspace').doc(CUR_EDIT_DOC).set({ meetings, updatedAt: new Date().toISOString(), updatedBy: (typeof currentUser!=='undefined' && currentUser?.email) || '' });
  _curEdits = { meetings };
  _curData = _curApplyEdits(_curOrig, _curEdits);
}

function curShowOverview(){
  const st = curSetting(); const s = curGetSem(st.grade, st.semester); if(!s) return;
  const ov = s.overview || {};
  const ovRows = [['Level',ov.jenjang],['Semester',ov.semester],['Duration',ov.durasi],['Sessions',ov.jumlahPertemuan],['Skills focus',ov.fokusKeterampilan],['Methods',ov.metode],['Main media',ov.mediaUtama]]
    .filter(r=>r[1]).map(r=>`<tr><td style="color:var(--muted);width:120px">${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('');
  _curModal('modal-cur-overview', `📚 ${esc(CUR_GRADES[st.grade])} · Semester ${st.semester}`,
    `<div class="tbl-wrap"><table style="font-size:0.84rem">${ovRows}</table></div>` +
    (s.cp ? _curSec('Learning outcome', `<div style="font-size:0.86rem;line-height:1.55">${esc(s.cp)}</div>`) : '') +
    _curSec('General objectives', _curList(s.generalObjectives)) +
    (s.grammarApproach ? _curSec('Grammar approach', `<div style="font-size:0.86rem;line-height:1.55">${esc(s.grammarApproach)}</div>`) : '') +
    _curSec('Session structure', `<div class="tbl-wrap"><table style="font-size:0.82rem"><tbody>${(s.sessionStructure||[]).map(x=>`<tr><td style="width:60px">${esc(x.waktu)}</td><td style="width:140px"><b>${esc(x.tahap)}</b></td><td>${esc(x.deskripsi)}</td></tr>`).join('')}</tbody></table></div>`) +
    _curSec('Unit map', `<div class="tbl-wrap"><table style="font-size:0.8rem"><thead><tr><th>#</th><th>Theme</th><th>Vocabulary</th><th>Grammar</th><th>Skill</th></tr></thead><tbody>${(s.petaMateri||[]).map(x=>`<tr><td>${esc(x.num)}</td><td><b>${esc(x.tema)}</b></td><td>${esc(x.kosakata)}</td><td>${esc(x.grammar)}</td><td>${esc(x.skill)}</td></tr>`).join('')}</tbody></table></div>`),
    '');
}

// ── Buat lesson dari sesi kurikulum ──
function curAddLesson(key){
  const r = curGetMeeting(key); if(!r) return;
  const m = r.m;
  if(typeof navigate==='function' && !document.getElementById('page-lessons')?.classList.contains('active')) navigate('lessons');
  resetLessonForm();
  document.getElementById('form-lesson-title').textContent = 'Add Lesson from Curriculum';
  document.getElementById('m-topik').value = `${m.num}: ${m.title}`;
  document.getElementById('m-deskripsi').value = [
    'Objectives:', ...(m.objectives||[]).map(x=>'- '+x), '',
    `Grammar: ${m.grammarPattern||''}${m.grammarExample?' (e.g. '+m.grammarExample+')':''}`,
    ...(m.grammarCorner?[`Grammar Corner: ${m.grammarCorner}`]:[]),
    ...(m.pronunciation?[`Pronunciation Drill: ${m.pronunciation}`]:[]),
    ...(m.readingWriting?[`Reading & Writing: ${m.readingWriting}`]:[]),
    `Vocabulary: ${(m.vocab||[]).join(', ')}`, '',
    'Activities:', ...(m.activities||[]).map(a=>`• ${a.waktu} ${a.kegiatan} — ${a.deskripsi}`),
  ].join('\n');
  document.getElementById('m-sumber').value = `LittleLume Curriculum · ${CUR_GRADES[r.grade]||r.grade} · Semester ${r.sem} · ${m.num}`;
  document.getElementById('m-kur').value = key;
  openPanel('form-lesson','900px');
  document.getElementById('form-lesson').scrollIntoView({behavior:'smooth'});
}

// ── Cetak rencana sesi ──
function curPrintMeeting(key){
  const r = curGetMeeting(key); if(!r) return;
  // Desain cetakan sama dengan Lesson Plan di halaman Lessons (js/lesson-print.js)
  const linked = materiList.find(l=>l.kurikulum===key);
  openLessonPlanPrint(linked ? lessonPrintData(linked) : _lpFromCurriculum(r));
}
