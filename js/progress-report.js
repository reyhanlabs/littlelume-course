// ════════════════════════════════════════════════
//  PROGRESS REPORT (RAPOR) PER GRADE
//  Kindergarten · Grade 1–3 · Grade 4–6
//  Data: raporList (koleksi 'rapor' di dokumen kelas)
//  Unit/topik diambil dari menu Lessons (periode laporan).
// ════════════════════════════════════════════════

const PR_GRADES = ['Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'];
const PR_LEVELS = [
  { v:1, key:'b', name:'Beginning',  desc:'Anak mulai mengenal dan membutuhkan banyak bantuan.' },
  { v:2, key:'d', name:'Developing', desc:'Anak mulai mampu menggunakan skill dengan sedikit bantuan.' },
  { v:3, key:'c', name:'Confident',  desc:'Anak mampu menggunakan skill secara mandiri dan konsisten.' },
];

const PR_TPL = {
  kg: {
    id:'kg', label:'Kindergarten', mascot:'sun', units:'Learning Progress', unitWord:'Topics',
    skills:[
      ['listening','Listening & Understanding'], ['speaking','Speaking Simple Words'], ['vocab','Vocabulary'],
      ['pron','Pronunciation'], ['instr','Following Instructions'], ['partic','Classroom Participation'],
      ['conf','Confidence in English'],
    ],
    notes:[['strengths','Strengths'],['improve','Areas to Improve'],['speaking','Speaking'],['confidence','Confidence'],['next','Next Steps']],
    defNotes:{
      strengths:'Shows interest in learning new English words and enjoys participating in playful activities.',
      improve:'Needs more practice in speaking simple English words and short phrases.',
      speaking:'Is beginning to repeat simple English words and phrases with teacher support.',
      confidence:'Is gradually building confidence in responding to simple questions.',
      next:'Continue practising basic vocabulary, simple instructions, and short English phrases through songs, games, and repetition.',
    },
    parent:'Every child learns at their own pace, and {name} is taking wonderful first steps. With patience, encouragement, and short, fun practice at home, confidence will grow step by step. Thank you for walking this journey with us!',
  },
  g13: {
    id:'g13', label:'Grade 1–3', mascot:'bee', units:'Learning Units', unitWord:'Units',
    skills:[
      ['listening','Listening & Understanding','Understands short stories and 2-step instructions.'],
      ['speaking','Speaking','Answers simple questions and speaks in short sentences.'],
      ['reading','Reading (Phonics & Sight Words)','Reads 3-letter words and common sight words.'],
      ['writing','Writing','Writes letters, words, and one simple sentence.'],
      ['vocab','Vocabulary','Uses new words from each unit correctly.'],
      ['grammar','Grammar & Sentence Making','Builds simple sentences (I am… / This is… / I like…).'],
    ],
    worksheet:[['listening','Listening'],['speaking','Speaking'],['reading','Reading'],['writing','Writing'],['vocab','Vocabulary'],['grammar','Grammar']],
    habits:[['attendance','Attendance & Punctuality'],['partic','Class Participation'],['indep','Independence'],['task','Task Completion']],
    notes:[['strengths','Strengths'],['improve','Areas to Improve'],['next','Next Steps'],['home','Practice at Home']],
    defNotes:{
      strengths:'Shows enthusiasm in English lessons and responds well to listening activities.',
      improve:'Needs more practice in writing simple sentences and forming letters neatly.',
      next:'Continue practising phonics, sight words, and sentence building through short daily activities and games.',
      home:'Read a picture book together for 10 minutes a day.\nPractise 5 new words with flash cards or games.\nEncourage short English sentences at home.',
    },
    attitude:'Shows curiosity and enthusiasm in class and is happy to join playful activities. Sometimes needs encouragement to keep trying when an activity feels difficult. Polite and kind to friends and teacher.',
    parent:'Every child learns at their own pace, and {name} is taking wonderful first steps. With patience, encouragement, and short, fun practice at home, confidence will grow step by step. Thank you for walking this journey with us!',
  },
  g46: {
    id:'g46', label:'Grade 4–6', mascot:'star', units:'Learning Units', unitWord:'Units', scored:true,
    skills:[
      ['listening','Listening & Understanding','Understands main ideas in short talks and conversations.'],
      ['speaking','Speaking & Presentation','Speaks clearly in dialogues and explains short material.'],
      ['reading','Reading Comprehension','Reads short texts and answers questions about them.'],
      ['writing','Writing (Paragraph)','Writes an organised paragraph of 4-5 sentences.'],
      ['vocab','Vocabulary','Uses topic words accurately in speaking and writing.'],
      ['grammar','Grammar in Use','Uses present, past, and future forms correctly.'],
    ],
    habits:[['attendance','Attendance & Punctuality'],['partic','Class Participation'],['resp','Responsibility'],['team','Teamwork & Collaboration']],
    summary:[['worksheets','Worksheets (average)'],['homework','Digital Interactive Homework'],['presentation','Dialog & Short Presentation']],
    rubric:[['understanding','Understanding'],['fluency','Pronunciation & Fluency'],['confidence','Confidence'],['language','Language Use']],
    notes:[['strengths','Strengths'],['improve','Areas to Improve'],['next','Next Steps'],['home','Study Tips at Home']],
    defNotes:{
      strengths:'Participates actively in class and shows strong vocabulary knowledge. Presents ideas clearly and confidently.',
      improve:'Needs more practice in writing organised paragraphs and using correct verb tenses.',
      next:'Continue practising paragraph writing, grammar exercises, and speaking in full sentences.',
      home:'Read for 15 minutes every day.\nWrite 3-5 sentences in a short daily journal.\nReview new vocabulary with flashcards or apps.',
    },
    attitude:'Shows good effort and a positive attitude in lessons, and is respectful to the teacher and classmates. Is beginning to take more initiative to ask questions and try new words. Needs gentle encouragement to keep trying when tasks feel challenging.',
    parent:'{name} is doing wonderfully in English! To keep the momentum going, please keep encouraging {name} to use English in daily life through stories, short conversations, and fun practice. Thank you for your continued support!',
  },
};
const PR_CEFR = [['Pre-A1','Starter'],['A1','Beginner'],['A2','Elementary'],['B1','Intermediate'],['B2','Upper-Intermediate']];

function prTplFor(grade){
  if(!grade || /kinder/i.test(grade)) return PR_TPL.kg;
  const n = +String(grade).replace(/\D/g,'');
  return n>=4 ? PR_TPL.g46 : PR_TPL.g13;
}
function prGuessGrade(s){
  const pick = t => {
    t = String(t||'');
    if(/kinder|\bTK\b|\bKG\b|paud/i.test(t)) return 'Kindergarten';
    const m = t.match(/(?:grade|kelas|class)\s*(\d)/i) || t.match(/^\s*(\d)\s*$/);
    if(m && +m[1]>=1 && +m[1]<=6) return 'Grade '+m[1];
    return '';
  };
  return pick(s && s.kelas) || pick(typeof currentClassName!=='undefined' ? currentClassName : '') || 'Grade 1';
}
function prLevelFromScore(n){ n=+n; if(isNaN(n)) return 0; return n>=80?3:n>=60?2:1; }
function prLevelOf(rec, val){ return prTplFor(rec.grade).scored ? prLevelFromScore(val) : (+val||0); }
function prPeriodLabel(dari, sampai){
  if(!dari || !sampai) return '';
  const a=new Date(dari+'T00:00:00'), b=new Date(sampai+'T00:00:00');
  const M = d=>d.toLocaleDateString('en-GB',{month:'long'});
  if(a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth()) return `${M(a)} ${a.getFullYear()}`;
  if(a.getFullYear()===b.getFullYear()) return `${M(a)} - ${M(b)} ${b.getFullYear()}`;
  return `${M(a)} ${a.getFullYear()} - ${M(b)} ${b.getFullYear()}`;
}
function _prISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// ── Unit dari menu Lessons ──
function _prUnitName(t){
  return String(t||'')
    .replace(/^\s*(session|sesi|meeting|pertemuan|lesson|unit)\s*\d+\s*[:.\-–—]\s*/i,'')
    .replace(/\s*[—–-]\s*(part|bagian)\s*\d+\s*$/i,'')
    .replace(/\s*\((part|bagian)\s*\d+\)\s*$/i,'')
    .trim();
}
function prUnitsFromLessons(siswaId, dari, sampai){
  const inRange = m => (!dari || (m.tanggal||'')>=dari) && (!sampai || (m.tanggal||'')<=sampai);
  const forStudent = m => !m.target || m.target==='Semua' || m.target===siswaId;
  let list = materiList.filter(m=>inRange(m) && forStudent(m));
  const done = list.filter(m=>m.status==='Selesai');
  if(done.length) list = done;
  list.sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||''));
  const seen = new Map();
  list.forEach(m=>{
    const name = _prUnitName(m.topik); if(!name) return;
    const k = name.toLowerCase();
    if(!seen.has(k)){
      const desc = String(m.deskripsi||'').split('\n').map(x=>x.replace(/^[#*\-•\s]+/,'').trim()).find(x=>x && x.length>8) || '';
      seen.set(k, { name, desc: desc.length>70 ? desc.slice(0,67).trim()+'…' : desc, val:'' });
    }
  });
  return [...seen.values()].slice(0,6);
}
function prAttendance(siswaId, dari, sampai){
  const att = absensiList.filter(a=>a.siswaId===siswaId && (!dari||a.tanggal>=dari) && (!sampai||a.tanggal<=sampai));
  const present = att.filter(a=>a.status==='Hadir').length;
  return { total:att.length, present, pct: att.length ? Math.round(present/att.length*100) : null };
}

// ════════════════════════════════════════════════
//  LIST (tab "Progress Report" di Evaluation)
// ════════════════════════════════════════════════
function renderProgressReports(){
  try{ prLoadAssets(); }catch(e){}   // siapkan font & logo rapor lebih awal
  const wrap = document.getElementById('pr-list'); if(!wrap) return;
  const fs = document.getElementById('pr-filter-siswa');
  if(fs){
    const cur = fs.value;
    fs.innerHTML = '<option value="">All Students</option>' + siswaList.map(s=>`<option value="${s.id}">${esc(s.nama)}</option>`).join('');
    fs.value = siswaList.some(s=>s.id===cur) ? cur : '';
  }
  const f = fs?.value || '';
  const list = [...raporList].filter(r=>!f || r.siswaId===f).sort((a,b)=>(b.sampai||'').localeCompare(a.sampai||'') || (b.updatedAt||'').localeCompare(a.updatedAt||''));
  document.getElementById('pr-empty').style.display = list.length ? 'none' : 'block';
  wrap.innerHTML = list.map(r=>{
    const t = prTplFor(r.grade);
    const lv = Object.values(r.skills||{}).map(v=>prLevelOf(r,v));
    const conf = lv.filter(x=>x===3).length;
    const s = siswaList.find(x=>x.id===r.siswaId);
    return `<div class="pr-card pr-${t.id}">
      <div class="pr-card-hd">
        <div class="dash-av" style="background:${typeof _dashColor==='function'?_dashColor(r.namaSiswa):'#8b5cf6'}">${esc((r.namaSiswa||'?').trim()[0]||'?')}</div>
        <div class="pr-card-who"><b>${esc(s?.nama||r.namaSiswa)}</b><span>${esc(prPeriodLabel(r.dari,r.sampai))}</span></div>
        <span class="pr-grade">${esc(r.grade)}</span>
      </div>
      <div class="pr-card-stats">
        <span class="pr-pill c">⭐ ${conf}/${t.skills.length} skills confident</span>
        <span class="pr-pill">📚 ${(r.units||[]).length} ${t.unitWord.toLowerCase()}</span>
        ${r.teacher?`<span class="pr-pill">👩‍🏫 ${esc(r.teacher)}</span>`:''}
      </div>
      <div class="pr-card-ft">
        <button class="btn primary sm" onclick="prView('${r.id}')">📄 View & Share</button>
        <button class="btn sm" onclick="prOpenForm('${r.id}')">✏️ Edit</button>
        <button class="btn sm" onclick="prDuplicate('${r.id}')" title="Copy into a new report for the next period">📑 Copy</button>
        <button class="btn danger sm icon-only" onclick="prDelete('${r.id}')" title="Delete">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function prDelete(id){
  const r = raporList.find(x=>x.id===id); if(!r) return;
  dangerModal('🗑️ Delete Progress Report', `Delete the progress report for <strong>${esc(r.namaSiswa)}</strong> (${esc(prPeriodLabel(r.dari,r.sampai))})?`,
    ()=>{ raporList = raporList.filter(x=>x.id!==id); DB.set('rapor', raporList); renderProgressReports(); },
    { okText:'Delete', cancelText:'Keep' });
}
function prDuplicate(id){
  const r = raporList.find(x=>x.id===id); if(!r) return;
  const a = new Date((r.sampai||todayISO())+'T00:00:00'); a.setDate(a.getDate()+1);
  const len = r.dari && r.sampai ? Math.round((new Date(r.sampai)-new Date(r.dari))/864e5) : 60;
  const b = new Date(a); b.setDate(b.getDate()+len);
  const copy = JSON.parse(JSON.stringify(r));
  copy.id=''; copy.dari=_prISO(a); copy.sampai=_prISO(b);
  copy.units = prUnitsFromLessons(r.siswaId, copy.dari, copy.sampai);
  _prDraft = copy; _prRenderForm();
  showToast('📑 Copied — check the new period and units, then save.','success');
}

// ════════════════════════════════════════════════
//  FORM
// ════════════════════════════════════════════════
let _prDraft = null;

function prOpenForm(id){
  if(id){
    const r = raporList.find(x=>x.id===id); if(!r) return;
    _prDraft = JSON.parse(JSON.stringify(r));
  } else {
    if(!siswaList.length){ infoModal('No Students','Add students first.'); return; }
    const now = new Date();
    const dari = new Date(now.getFullYear(), now.getMonth()-1, 1), sampai = new Date(now.getFullYear(), now.getMonth()+1, 0);
    const last = [...raporList].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0];
    _prDraft = { id:'', siswaId:'', grade:'', dari:_prISO(dari), sampai:_prISO(sampai), teacher:last?.teacher||_prLastTeacher(),
      skills:{}, units:[], habits:{}, worksheet:{}, summary:{}, pres:{}, notes:{}, attitude:'', parentNote:'', cefr:'A1' };
  }
  _prRenderForm();
}
function _prLastTeacher(){ try{ return localStorage.getItem('prTeacher')||''; }catch(e){ return ''; } }
function prCloseForm(){
  _prDraft = null;
  const c = document.getElementById('pr-form-card'); if(c){ c.style.display='none'; c.innerHTML=''; }
  document.getElementById('pr-list-wrap').style.display='';
}

function _prLevelPicker(group, key, val){
  return `<div class="pr-lv" data-g="${group}" data-k="${key}">${PR_LEVELS.map(l=>
    `<button type="button" class="pr-lv-btn ${l.key} ${+val===l.v?'on':''}" onclick="prSetLevel(this,${l.v})">${l.name}</button>`).join('')}</div>`;
}
function prSetLevel(btn, v){
  const box = btn.closest('.pr-lv'); const g=box.dataset.g, k=box.dataset.k;
  box.querySelectorAll('.pr-lv-btn').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  if(g==='units'){ _prDraft.units[+k].val = v; }
  else { _prDraft[g] = _prDraft[g]||{}; _prDraft[g][k] = v; }
}
function prSetField(g, k, el){
  let v = el.value;
  if(el.type==='number'){ v = v==='' ? '' : Math.max(+el.min||0, Math.min(+el.max||100, +v)); }
  if(g==='units'){ const [i,f]=k.split('.'); _prDraft.units[+i][f]=v; return; }
  if(g){ _prDraft[g]=_prDraft[g]||{}; _prDraft[g][k]=v; } else _prDraft[k]=v;
  if(k==='dari'||k==='sampai'){ const el2=document.getElementById('pr-period-lbl'); if(el2) el2.textContent=prPeriodLabel(_prDraft.dari,_prDraft.sampai); }
}
function prOnStudentChange(el){
  _prDraft.siswaId = el.value;
  const s = siswaList.find(x=>x.id===el.value);
  if(s && !_prDraft.id){ _prDraft.grade = prGuessGrade(s); _prDraft.units = prUnitsFromLessons(s.id, _prDraft.dari, _prDraft.sampai); _prApplyDefaults(true); }
  _prRenderForm();
}
function prOnGradeChange(el){
  const before = prTplFor(_prDraft.grade).id;
  _prDraft.grade = el.value;
  if(prTplFor(el.value).id !== before){ _prDraft.skills={}; _prDraft.habits={}; _prDraft.units=(_prDraft.units||[]).map(u=>({...u,val:''})); _prApplyDefaults(true); }
  _prRenderForm();
}
function prReloadUnits(){
  if(!_prDraft.siswaId){ showToast('Select a student first.','warn'); return; }
  const fresh = prUnitsFromLessons(_prDraft.siswaId, _prDraft.dari, _prDraft.sampai);
  const old = new Map((_prDraft.units||[]).map(u=>[u.name.toLowerCase(),u]));
  _prDraft.units = fresh.map(u=>old.get(u.name.toLowerCase()) || u);
  _prRenderForm();
  showToast(fresh.length ? `📚 ${fresh.length} unit(s) loaded from Lessons.` : 'No lessons found in this period — add units manually.', fresh.length?'success':'warn');
}
function prAddUnit(){ if((_prDraft.units||[]).length>=6){ showToast('Up to 6 units per report.','warn'); return; } _prDraft.units.push({name:'',desc:'',val:''}); _prRenderForm(); }
function prRemoveUnit(i){ _prDraft.units.splice(i,1); _prRenderForm(); }
function prMoveUnit(i,d){ const u=_prDraft.units, j=i+d; if(j<0||j>=u.length) return; [u[i],u[j]]=[u[j],u[i]]; _prRenderForm(); }

// Isi teks bawaan (catatan guru, sikap, pesan orang tua) bila masih kosong
function _prApplyDefaults(force){
  const t = prTplFor(_prDraft.grade);
  _prDraft.notes = _prDraft.notes || {};
  t.notes.forEach(([k])=>{ if(force || !_prDraft.notes[k]) _prDraft.notes[k] = t.defNotes[k]||''; });
  if(t.attitude && (force || !_prDraft.attitude)) _prDraft.attitude = t.attitude;
  if(force || !_prDraft.parentNote) _prDraft.parentNote = t.parent;
  // Kebiasaan "Attendance" disarankan dari data absensi
  if(t.habits && _prDraft.siswaId){
    const a = prAttendance(_prDraft.siswaId, _prDraft.dari, _prDraft.sampai);
    _prDraft.habits = _prDraft.habits || {};
    if(a.pct!==null && !_prDraft.habits.attendance) _prDraft.habits.attendance = a.pct>=90?3:a.pct>=70?2:1;
  }
}

function _prRenderForm(){
  const d = _prDraft; const card = document.getElementById('pr-form-card'); if(!card||!d) return;
  if(!d.grade) d.grade = 'Grade 1';
  const t = prTplFor(d.grade);
  const s = siswaList.find(x=>x.id===d.siswaId);
  const att = d.siswaId ? prAttendance(d.siswaId, d.dari, d.sampai) : null;
  const num = (g,k,max,ph) => `<input type="number" min="0" max="${max}" value="${esc(String((d[g]||{})[k]??''))}" placeholder="${ph||'0–'+max}" oninput="prSetField('${g}','${k}',this)">`;
  const area = (g,k,rows,ph) => `<textarea rows="${rows||2}" placeholder="${ph||''}" oninput="prSetField('${g}','${k}',this)">${esc(g?((d[g]||{})[k]||''):(d[k]||''))}</textarea>`;
  const sec = (title, sub, body) => `<div class="pr-sec"><div class="pr-sec-hd"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</div>${body}</div>`;

  const skillsBody = `<div class="pr-rows">${t.skills.map(([k,name,cd])=>`
    <div class="pr-row"><div class="pr-row-lbl"><b>${name}</b>${cd?`<small>${cd}</small>`:''}</div>
      ${t.scored ? `<div class="pr-score">${num('skills',k,100)}<span class="pr-auto">${_prLvTag(prLevelFromScore((d.skills||{})[k]), (d.skills||{})[k])}</span></div>` : _prLevelPicker('skills',k,(d.skills||{})[k])}
    </div>`).join('')}</div>`;

  const unitsBody = `
    <div class="pr-unit-tools">
      <button class="btn sm" onclick="prReloadUnits()">↻ Load from Lessons</button>
      <button class="btn sm" onclick="prAddUnit()">＋ Add ${t.unitWord==='Topics'?'topic':'unit'}</button>
      <span class="pr-hint">Taken from lessons in the report period (completed first). Max 6.</span>
    </div>
    ${(d.units||[]).length ? `<div class="pr-rows">${d.units.map((u,i)=>`
      <div class="pr-row pr-unit">
        <div class="pr-unit-no">${i+1}</div>
        <div class="pr-unit-fields">
          <input type="text" value="${esc(u.name)}" placeholder="${t.unitWord==='Topics'?'Topic':'Unit'} name" oninput="prSetField('units','${i}.name',this)">
          ${t.id==='g13'?`<input type="text" value="${esc(u.desc||'')}" placeholder="Can-do (e.g. Names classroom objects and greets friends.)" oninput="prSetField('units','${i}.desc',this)">`:''}
        </div>
        ${t.scored ? `<div class="pr-score"><input type="number" min="0" max="100" value="${esc(String(u.val??''))}" placeholder="0–100" oninput="prSetField('units','${i}.val',this)"></div>` : _prLevelPicker('units',i,u.val)}
        <div class="pr-unit-act">
          <button class="btn sm icon-only" onclick="prMoveUnit(${i},-1)" title="Move up">↑</button>
          <button class="btn danger sm icon-only" onclick="prRemoveUnit(${i})" title="Remove">✕</button>
        </div>
      </div>`).join('')}</div>` : `<div class="pr-hint" style="padding:8px 0">No ${t.unitWord.toLowerCase()} yet — tap <b>Load from Lessons</b> or add one.</div>`}`;

  const habitsBody = t.habits ? `<div class="pr-rows">${t.habits.map(([k,name])=>`
    <div class="pr-row"><div class="pr-row-lbl"><b>${name}</b>${k==='attendance'&&att&&att.total?`<small>Attendance this period: ${att.present}/${att.total} (${att.pct}%)</small>`:''}</div>${_prLevelPicker('habits',k,(d.habits||{})[k])}</div>`).join('')}</div>` : '';

  const html = `
    <div class="pr-form-hd">
      <div><b>${d.id?'✏️ Edit Progress Report':'📝 New Progress Report'}</b><span>${t.label} template</span></div>
      <button class="btn sm icon-only" onclick="prCloseForm()" title="Close">✕</button>
    </div>
    ${sec('👤 Student & Period','',`
      <div class="pr-grid4">
        <div class="form-group"><label>Student *</label><select onchange="prOnStudentChange(this)"><option value="">-- Select Student --</option>${siswaList.map(x=>`<option value="${x.id}" ${x.id===d.siswaId?'selected':''}>${esc(x.nama)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Class / Level</label><select onchange="prOnGradeChange(this)">${PR_GRADES.map(g=>`<option ${g===d.grade?'selected':''}>${g}</option>`).join('')}</select></div>
        <div class="form-group"><label>From</label><input type="date" value="${d.dari||''}" onchange="prSetField('','dari',this)"></div>
        <div class="form-group"><label>To</label><input type="date" value="${d.sampai||''}" onchange="prSetField('','sampai',this)"></div>
        <div class="form-group"><label>Teacher</label><input type="text" value="${esc(d.teacher||'')}" placeholder="e.g. Miss Lonny" oninput="prSetField('','teacher',this)"></div>
        <div class="form-group pr-span3"><label>Reporting period</label><div class="pr-period" id="pr-period-lbl">${esc(prPeriodLabel(d.dari,d.sampai))}</div></div>
      </div>`)}
    ${!s ? '<div class="pr-hint" style="padding:6px 2px 14px">Select a student to fill in the report.</div>' : `
    ${t.id==='g46' ? sec('🏅 Overview','Overall score is the average of the skill scores', `
      <div class="pr-grid4">
        <div class="form-group"><label>English level (CEFR)</label><select onchange="prSetField('','cefr',this)">${PR_CEFR.map(([c,n])=>`<option value="${c}" ${d.cefr===c?'selected':''}>${c} · ${n}</option>`).join('')}</select></div>
        <div class="form-group"><label>Attendance (from records)</label><div class="pr-period">${att&&att.total?`${att.pct}% · ${att.present}/${att.total} sessions`:'No records in this period'}</div></div>
      </div>`) : ''}
    ${sec('🗣️ English Skills', t.scored?'Score 0–100 · Below 60 Beginning · 60–79 Developing · 80–100 Confident':'Tap a level for each skill', skillsBody)}
    ${sec(`📚 ${t.units}`, t.scored?'Score 0–100 for each unit':'', unitsBody)}
    ${t.habits ? sec('🌱 Learning Habits','',habitsBody) : ''}
    ${t.habits ? sec('💛 Learning Attitude','Teacher\'s observation', area('','attitude',3)) : ''}
    ${t.worksheet ? sec('📝 Worksheet Scores','Out of 10', `<div class="pr-grid6">${t.worksheet.map(([k,n])=>`<div class="form-group"><label>${n}</label>${num('worksheet',k,10,'0–10')}</div>`).join('')}</div>`) : ''}
    ${t.summary ? sec('📊 Score Summary','Out of 100 · this period', `<div class="pr-grid4">${t.summary.map(([k,n])=>`<div class="form-group"><label>${n}</label>${num('summary',k,100)}</div>`).join('')}</div>`) : ''}
    ${t.rubric ? sec('🎤 Dialog & Short Presentation','Rubric assessment', `
      <div class="form-group"><label>Latest speaking tasks (one per line)</label>${area('pres','tasks',2,'Dialog: Ordering Food\nShort Explanation: My Favourite Food')}</div>
      <div class="pr-rows">${t.rubric.map(([k,n])=>`<div class="pr-row"><div class="pr-row-lbl"><b>${n}</b></div>${_prLevelPicker('pres',k,(d.pres||{})[k])}</div>`).join('')}</div>`) : ''}
    ${sec('✍️ Teacher\'s Note','Pre-filled with a suggestion — edit freely', `<div class="pr-grid2">${t.notes.map(([k,n])=>`<div class="form-group ${k==='next'&&t.id==='kg'?'pr-span2':''}"><label>${n}${k==='home'?' <small>(one tip per line)</small>':''}</label>${area('notes',k,3)}</div>`).join('')}</div>`)}
    ${sec('💌 Note for Parents','Use {name} for the student\'s name', area('','parentNote',3))}
    <div class="btn-row pr-form-ft">
      <button class="btn primary" onclick="prSave(false)">💾 Save</button>
      <button class="btn wa" onclick="prSave(true)">💾 Save & View Report</button>
      <button class="btn" onclick="prCloseForm()">Cancel</button>
    </div>`}`;
  card.innerHTML = html; card.style.display='block';
  document.getElementById('pr-list-wrap').style.display='none';
}
function _prLvTag(lv, val){
  if(val===''||val===undefined||val===null) return '<span class="pr-tag">—</span>';
  const l = PR_LEVELS[lv-1]; return l ? `<span class="pr-tag ${l.key}">${l.name}</span>` : '';
}
// Perbarui label level otomatis saat skor diketik (Grade 4–6)
document.addEventListener('input', e=>{
  const inp = e.target; if(!inp.closest || !inp.closest('#pr-form-card .pr-score')) return;
  const tag = inp.parentElement.querySelector('.pr-auto'); if(tag) tag.innerHTML = _prLvTag(prLevelFromScore(inp.value), inp.value);
});

function prSave(thenView){
  const d = _prDraft; if(!d) return;
  const s = siswaList.find(x=>x.id===d.siswaId);
  if(!s){ showToast('Please select a student first!','warn'); return; }
  if(!d.dari || !d.sampai || d.dari>d.sampai){ showToast('Please set a valid report period.','warn'); return; }
  const t = prTplFor(d.grade);
  const missing = t.skills.filter(([k])=>(d.skills||{})[k]===undefined || (d.skills||{})[k]==='').length;
  d.units = (d.units||[]).filter(u=>String(u.name||'').trim());
  d.namaSiswa = s.nama; d.updatedAt = new Date().toISOString();
  if(d.teacher) try{ localStorage.setItem('prTeacher', d.teacher); }catch(e){}
  if(d.id){ const i = raporList.findIndex(x=>x.id===d.id); if(i>-1) raporList[i] = d; else raporList.push(d); }
  else { d.id = uid(); raporList.push(d); }
  DB.set('rapor', raporList);
  const id = d.id;
  prCloseForm(); renderProgressReports();
  showToast(`✅ Progress report saved${missing?` — ${missing} skill(s) not rated yet`:''}.`, missing?'warn':'success');
  if(thenView) prView(id);
}

// ════════════════════════════════════════════════
//  DESAIN RAPOR (A4, 794px) — dipakai untuk preview, cetak, PDF & gambar
// ════════════════════════════════════════════════
const _PR_THEME = {
  kg:  { h1:'#6c5ce7', h2:'#8676f3', page:'#fff9ef', thead:'#efeafd', line:'#e8e1fb', dot:'#6c5ce7', foot:'#6c5ce7', parent:['#c026d3','#fb7185'] },
  g13: { h1:'#139c91', h2:'#2bb7aa', page:'#f2faf9', thead:'#e1f4f1', line:'#d3ece8', dot:'#17a398', foot:'#17a398', parent:['#fb7185','#fbbf24'] },
  g46: { h1:'#1e3a8a', h2:'#2f5bdc', page:'#f4f7fd', thead:'#e3eafb', line:'#d8e2f7', dot:'#2f55d4', foot:'#2f55d4', parent:['#4338ca','#db2777'] },
};
const _PR_LV_COL = { 1:['#f87171','#ffe4e1','#e2554f'], 2:['#2fae6e','#dcf3e6','#22955a'], 3:['#f2a900','#fff1c1','#d99400'] };

function _prIcon(lv, size){
  size=size||20;
  if(lv===3) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="#f2a900" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`;
  if(lv===2) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="#2fae6e" d="M20 4C10 4 4 9 4 16c0 1.5.4 2.9 1 4 1-4 4-8 9-10-4 3-6.5 6.3-7.5 10.5C8 21 9.5 21 11 21c7 0 9-7 9-17z"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="none" stroke="#f0645f" stroke-width="2.4" stroke-linecap="round" d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/></svg>`;
}
function _prBars(lv){
  const c = _PR_LV_COL[lv]||['#e5e7eb'];
  return `<span class="bars">${[1,2,3].map(i=>`<i style="background:${i<=lv?c[0]:'#e4e7ee'}"></i>`).join('')}</span>`;
}
function _prLvTxt(lv){ const l=PR_LEVELS[lv-1]; return l?`<span class="lvt" style="color:${_PR_LV_COL[lv][2]}">${l.name}</span>`:'<span class="lvt" style="color:#9aa3b5">Not rated</span>'; }

// ── Aset rapor: logo + font ditanam (data URI) ──
// html2canvas memotret salinan dokumen; kalau font masih diunduh dari Google,
// hurufnya dipotret dengan font cadangan → jarak huruf berantakan. Font & logo
// ditanam langsung supaya PDF/gambar selalu sama dengan tampilan.
const _PR_FONT_URL = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Lora:ital@1&display=swap';
let _PR_ASSETS = null, _prAssetsP = null;
function _prLogoSrc(){ return (_PR_ASSETS && _PR_ASSETS.logo) || new URL('favicon-256x256.png', location.href).href; }
function _prBlobToDataURL(b){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(b); }); }
function prLoadAssets(){
  if(_PR_ASSETS) return Promise.resolve(_PR_ASSETS);
  if(_prAssetsP) return _prAssetsP;
  _prAssetsP = (async()=>{
    const out = { fontCSS:'', logo:'' };
    try{ const b = await (await fetch('favicon-256x256.png')).blob(); out.logo = await _prBlobToDataURL(b); }catch(e){}
    try{
      const css = await (await fetch(_PR_FONT_URL)).text();
      const blocks = css.split('@font-face').slice(1).map(x=>'@font-face'+x.slice(0, x.indexOf('}')+1));
      // hanya subset latin (atau blok tanpa unicode-range)
      const keep = blocks.filter(b=>!/unicode-range/.test(b) || /U\+0000-00FF/i.test(b));
      const faces = await Promise.all(keep.map(async b=>{
        const m = b.match(/url\(([^)]+)\)/); if(!m) return '';
        const url = m[1].replace(/['"]/g,'');
        const data = await _prBlobToDataURL(await (await fetch(url)).blob());
        return b.replace(m[0], `url(${data})`);
      }));
      out.fontCSS = faces.filter(Boolean).join('\n');
    }catch(e){ console.warn('Report fonts not embedded', e); }
    // Daftarkan juga di dokumen utama: html2canvas menggambar teks di canvas milik
    // dokumen utama, jadi fontnya harus dikenal di sini juga.
    if(out.fontCSS && !document.getElementById('pr-font-faces')){
      const st=document.createElement('style'); st.id='pr-font-faces'; st.textContent=out.fontCSS; document.head.appendChild(st);
    }
    _PR_ASSETS = out; return out;
  })();
  _prAssetsP.catch(()=>{ _prAssetsP = null; });
  return _prAssetsP;
}

function _prCSS(th){
  return `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Poppins',Arial,sans-serif;color:#28324a;background:#e9ecf3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:794px;height:1123px;position:relative;overflow:hidden;background:${th.page};margin:0 auto 18px}
  @media print{ body{background:none} .page{margin:0;page-break-after:always;break-after:page} @page{size:A4;margin:0} }
  .hdr{position:relative;height:138px;background:linear-gradient(120deg,${th.h1},${th.h2});overflow:hidden}
  .hdr .b1{position:absolute;border-radius:50%;background:rgba(255,255,255,.12)}
  .hdr-in{position:relative;display:flex;align-items:center;gap:18px;padding:10px 40px 0 46px}
  .mascot{width:104px;height:104px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 6px 18px rgba(0,0,0,.12);overflow:hidden}
  .mascot img{width:100px;height:100px;border-radius:50%;display:block}
  .brand h1{font-size:31px;font-weight:800;color:#fff;letter-spacing:-.5px;line-height:1.1;white-space:nowrap}
  .brand h1 span{color:#ffcf4a}
  .brand p{font-size:11px;font-weight:700;color:rgba(255,255,255,.85);letter-spacing:3.5px;margin-top:4px;white-space:nowrap}
  .ed{margin-left:auto;background:#fff;border-radius:30px;padding:11px 34px;text-align:center;position:relative;flex-shrink:0}
  .ed b{display:block;font-size:11.5px;font-weight:800;color:${th.h1};letter-spacing:.2px;white-space:nowrap}
  .ed span{font-size:10.5px;color:#8b93a7}
  .ed i{position:absolute;top:16px;font-style:normal;color:#f2b600;font-size:15px}
  .info{position:relative;margin:-30px 40px 0;background:#fff;border-radius:20px;border:2px solid ${th.line};display:grid;grid-template-columns:1fr 1fr 1.25fr 1fr;padding:12px 18px;gap:10px;box-shadow:0 6px 16px rgba(30,40,80,.06)}
  .info div{border-left:4px solid;padding-left:10px}
  .info small{display:block;font-size:9px;font-weight:700;color:#8b93a7;letter-spacing:.6px}
  .info b{font-size:14px;font-weight:700;color:#28324a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
  .mini{height:84px;background:linear-gradient(120deg,${th.h1},${th.h2});position:relative;overflow:hidden;display:flex;align-items:center;padding:0 40px;gap:14px}
  .mini .m{width:60px;height:60px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
  .mini .m img{width:56px;height:56px;border-radius:50%;display:block}
  .mini h2{font-size:24px;font-weight:800;color:#fff}.mini h2 span{color:#ffcf4a}
  .mini .who{margin-left:auto;background:#fff;border-radius:22px;padding:10px 26px;font-size:12px;font-weight:700;color:${th.h1};position:relative}
  .body{padding:16px 40px 0}
  .st{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700;margin:0 0 7px}
  .st:before{content:'';width:12px;height:12px;border-radius:50%;background:var(--d,${th.dot})}
  .st .chip{font-size:9px;font-weight:800;background:#dbeafe;color:#3767c8;border-radius:12px;padding:4px 12px;letter-spacing:.4px}
  .bars{display:inline-flex;gap:4px}.bars i{display:block;width:26px;height:9px;border-radius:6px}
  .lvt{font-size:10.5px;font-weight:700}
  table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:2px solid ${th.line};border-radius:16px;overflow:hidden}
  th{background:${th.thead};font-size:9.5px;font-weight:800;letter-spacing:.6px;color:${th.h1};text-align:left;padding:9px 18px}
  td{padding:6px 18px;font-size:12.5px;vertical-align:middle}
  tr:nth-child(even) td{background:#f8f9fc}
  td small{display:block;font-size:10.5px;color:#8b93a7;margin-top:2px}
  td b{font-weight:700;font-size:13px}
  .lvcell{display:flex;align-items:center;gap:8px;white-space:nowrap}
  .scale{display:grid;gap:10px}
  .sc{border-radius:16px;padding:10px 12px;display:flex;gap:12px;align-items:flex-start;position:relative}
  .sc .ic{width:40px;height:40px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sc b{font-size:14px;font-weight:700;display:block}
  .sc p{font-size:9.5px;color:#5b6478;margin-top:3px;line-height:1.45}
  .sc .bars{position:absolute;right:14px;top:16px}.sc .bars i{width:14px;height:6px}
  .sc .rng{position:absolute;right:14px;top:14px;font-size:10px;font-weight:800}
  .units{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
  .un{border-radius:14px;padding:9px 12px}
  .un .top{display:flex;align-items:center;gap:10px}
  .un .ic{width:34px;height:34px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .un b{font-size:14.5px;font-weight:700;display:block;line-height:1.2}
  .un em{font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.4px;display:block}
  .un p{font-size:10px;color:#5b6478;margin-top:5px;line-height:1.35}
  .un .sc2{margin-left:auto;font-size:20px;font-weight:800}
  .un .pb{height:7px;border-radius:5px;background:#fff;margin-top:8px;overflow:hidden;width:80%}.un .pb i{display:block;height:100%;border-radius:5px}
  .notes{background:#fff;border:2px solid #fbd5cf;border-radius:16px;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .nt{border-radius:10px;padding:7px 11px;border-left:5px solid}
  .nt small{display:block;font-size:8.5px;font-weight:800;letter-spacing:.6px;margin-bottom:2px}
  .nt p{font-size:10.3px;font-style:italic;line-height:1.45;color:#3a4256}
  .nt.full{grid-column:1/-1}
  .snap{background:#fff;border:2px solid ${th.line};border-radius:14px;padding:6px 16px}
  .snap .r{display:flex;align-items:center;gap:10px;margin:4px 0}
  .snap .r>b{width:86px;font-size:11px;font-weight:700;flex-shrink:0}
  .snap .seg{display:flex;flex:1;gap:4px}
  .snap .seg div{height:18px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:10.5px;font-weight:700;min-width:44px;position:relative}
  .snap .seg div svg{flex-shrink:0}
  .hab{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .hb{border-radius:14px;padding:8px 10px}
  .hb .t{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;line-height:1.2;min-height:30px}
  .hb .ic{width:28px;height:28px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .hb .l{display:flex;align-items:center;gap:8px;margin-top:6px}.hb .bars i{width:18px;height:7px}
  .att{background:#fffbea;border:2px solid #fde3a1;border-radius:16px;padding:12px 16px;border-left:6px solid #f2a900;height:100%}
  .att small{font-size:9px;font-weight:800;color:#e08b00;letter-spacing:.5px}
  .att p{font-size:11px;font-style:italic;line-height:1.6;margin-top:8px;color:#3a4256}
  .bar-list{background:#fff;border:2px solid ${th.line};border-radius:14px;padding:7px 22px}
  .bl{display:flex;align-items:center;gap:16px;margin:5px 0}
  .bl b{width:200px;font-size:12px;font-weight:700;flex-shrink:0}
  .bl .tr{flex:1;height:13px;border-radius:8px;background:#e8ecf3;overflow:hidden}.bl .tr i{display:block;height:100%;border-radius:8px}
  .bl span{width:60px;text-align:right;font-size:12px;font-weight:800}
  .parent{position:relative;border-radius:20px;padding:26px 22px 18px;background:linear-gradient(110deg,${th.parent[0]},${th.parent[1]})}
  .parent .lbl{position:absolute;top:-16px;left:24px;background:${th.parent[0]};color:#fff;border-radius:20px;padding:6px 24px 6px 12px;font-family:'Lora',Georgia,serif;font-style:italic;font-size:15px;display:flex;align-items:center;gap:8px}
  .parent .lbl i{width:22px;height:22px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;color:${th.parent[0]};font-size:11px}
  .parent .q{background:#fff;border-radius:14px;padding:12px 20px 12px 58px;font-family:'Lora',Georgia,serif;font-style:italic;font-size:12.5px;line-height:1.65;color:#3a4256;position:relative}
  .parent .q:before{content:'\\201C';position:absolute;left:18px;top:2px;font-size:54px;color:#f2b600;font-family:Georgia,serif;font-style:normal}
  .pband{border-radius:18px;background:linear-gradient(110deg,${th.parent[0]},${th.parent[1]});display:flex;align-items:center;gap:16px;padding:10px 20px;color:#fff}
  .pband .h{width:46px;height:46px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;color:${th.parent[0]};font-size:20px;flex-shrink:0}
  .pband .tt{font-family:'Lora',Georgia,serif;font-style:italic;font-size:19px;line-height:1.1;white-space:nowrap;flex-shrink:0;padding-right:18px;border-right:1.5px dashed rgba(255,255,255,.6)}
  .pband .tt span{color:#ffd76a}
  .pband p{font-family:'Lora',Georgia,serif;font-style:italic;font-size:11.5px;line-height:1.55}
  .foot{position:absolute;left:0;right:0;bottom:0;height:44px;background:${th.foot};color:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;font-size:11px}
  .foot i{font-style:italic;opacity:.95}.foot b{font-size:10px;font-weight:700;margin-top:2px;letter-spacing:.3px}
  .foot .pg{position:absolute;right:40px;top:15px;font-size:10px;opacity:.9}
  .foot .fl{position:absolute;left:40px;top:6px;width:32px;height:32px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
  .foot .fl img{width:30px;height:30px;border-radius:50%;display:block}
  .foot .st1,.foot .st2{position:absolute;top:12px;color:#ffcf4a;font-size:16px}.foot .st1{left:40px}.foot .st2{right:40px}
  .sum3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .sm{background:#fff;border:2px solid ${th.line};border-radius:18px;padding:10px 14px;display:flex;align-items:center;gap:14px}
  .sm small{display:block;font-size:9px;font-weight:700;color:#8b93a7;letter-spacing:.5px}
  .sm b{display:block;font-size:16px;font-weight:700}
  .sm em{font-style:normal;font-size:10.5px;font-weight:700}
  .cefr{background:#fbbf24;border-radius:12px;padding:6px 14px;font-size:24px;font-weight:800;color:#1f2a44}
  .dots{display:flex;align-items:center;gap:0;margin-top:6px}.dots i{width:8px;height:8px;border-radius:50%;background:#cbd5e1;display:block}.dots s{width:22px;height:2px;background:#cbd5e1;display:block}
  .pres{background:#fff;border:2px solid ${th.line};border-radius:16px;overflow:hidden}
  .pres .ph{background:#f1edff;padding:9px 18px;display:flex;align-items:center;gap:12px}
  .pres .ph small{display:block;font-size:9px;font-weight:800;color:#7c3aed;letter-spacing:.5px}
  .pres .ph b{font-size:13.5px;font-weight:700}
  .pres .ph em{margin-left:auto;font-style:normal;background:#f2a900;color:#1f2a44;border-radius:16px;padding:6px 16px;font-size:10px;font-weight:800;white-space:nowrap}
  .pres .pg2{display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;padding:9px 18px}
  .pres .pg2 div{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700}
  .pres .pg2 div span:first-child{width:150px}
  .pres .bars i{width:18px;height:7px}
  /* Pemadatan bertahap bila isi terlalu panjang (lihat prFit) */
  .page.t1 .st{margin-bottom:5px;font-size:15px} .page.t1 td{padding-top:4px!important;padding-bottom:4px!important}
  .page.t1 .nt{padding:5px 10px} .page.t1 .nt p{font-size:9.8px;line-height:1.38} .page.t1 .un{padding:7px 10px}
  .page.t1 .sc{padding:8px 10px} .page.t1 .scale{gap:7px} .page.t1 .hb{padding:6px 9px} .page.t1 .bl{margin:3px 0}
  .page.t1 .parent .q,.page.t1 .pband p{font-size:11.2px;line-height:1.5}
  .page.t2 .st{margin-bottom:4px;font-size:14px} .page.t2 td{padding-top:3px!important;padding-bottom:3px!important;font-size:11.5px}
  .page.t2 .nt{padding:4px 9px} .page.t2 .nt p{font-size:9.2px;line-height:1.32} .page.t2 .notes{gap:6px;padding:8px}
  .page.t2 .un{padding:6px 10px} .page.t2 .un p{font-size:9px} .page.t2 .sc{padding:6px 10px} .page.t2 .sc p{font-size:8.8px}
  .page.t2 .scale{gap:6px} .page.t2 .hb{padding:5px 8px} .page.t2 .att p{font-size:10px;line-height:1.45} .page.t2 .bl{margin:2px 0}
  .page.t2 .parent{padding:22px 18px 14px} .page.t2 .parent .q,.page.t2 .pband p{font-size:10.5px;line-height:1.45}
  .page.t2 .body [style*="margin-top:11px"]{margin-top:7px!important} .page.t2 .body [style*="margin-top:12px"]{margin-top:8px!important}
  `;
}

function _prDonut(pct, color, label){
  const r=26, c=2*Math.PI*r, p=Math.max(0,Math.min(100,+pct||0));
  return `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#e8ecf3" stroke-width="8"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c*p/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle" font-family="Poppins,Arial" font-size="${String(label).length>3?13:16}" font-weight="700" fill="#28324a">${label}</text></svg>`;
}

function buildProgressReportHTML(r, opt){
  opt = opt||{};
  const t = prTplFor(r.grade), th = _PR_THEME[t.id];
  const s = siswaList.find(x=>x.id===r.siswaId) || {};
  const name = s.nama || r.namaSiswa || 'Student';
  const nick = s.nick || name.split(' ')[0];
  const period = prPeriodLabel(r.dari, r.sampai);
  const fill = txt => esc(String(txt||'').replace(/\{name\}/g, nick));
  const lvOf = v => t.scored ? prLevelFromScore(v) : (+v||0);
  const skillLv = t.skills.map(([k])=>lvOf((r.skills||{})[k]));
  const units = (r.units||[]).slice(0,6);
  const unitLv = units.map(u=>lvOf(u.val));
  const habitLv = (t.habits||[]).map(([k])=>+((r.habits||{})[k])||0);
  const count = (arr,l)=>arr.filter(x=>x===l).length;
  const LVBG = lv => (_PR_LV_COL[lv]||['#e5e7eb','#eef1f6'])[1];

  const header = `
    <div class="hdr"><div class="b1" style="width:180px;height:180px;right:-40px;top:-70px"></div><div class="b1" style="width:110px;height:110px;left:300px;top:-50px"></div><div class="b1" style="width:220px;height:220px;right:120px;top:60px;opacity:.6"></div><div class="b1" style="width:70px;height:70px;left:420px;top:90px"></div>
      <div class="hdr-in"><div class="mascot"><img src="${_prLogoSrc()}" alt="LittleLume English"></div>
        <div class="brand"><h1>LittleLume <span>English</span></h1><p>LEARN · PLAY · SHINE</p></div>
        <div class="ed"><i style="left:14px">★</i><b>STUDENT PROGRESS REPORT</b><span>${t.id==='kg'?'Kindergarten':t.id==='g13'?esc(r.grade):'Grade 4 - 6'} Edition</span><i style="right:14px">★</i></div>
      </div></div>
    <div class="info">
      <div style="border-color:#f08a8a"><small>STUDENT NAME</small><b>${esc(name)}</b></div>
      <div style="border-color:#60b6f4"><small>CLASS / LEVEL</small><b>${esc(r.grade)}</b></div>
      <div style="border-color:#fbcf4a"><small>REPORTING PERIOD</small><b>${esc(period)}</b></div>
      <div style="border-color:#6fd3a6"><small>TEACHER</small><b>${esc(r.teacher||'—')}</b></div>
    </div>`;
  const mini = `<div class="mini"><div class="b1" style="position:absolute;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.12);right:260px;top:-70px"></div>
      <div class="m"><img src="${_prLogoSrc()}" alt=""></div><h2>LittleLume <span>English</span></h2><div class="who">${esc(name)} · ${esc(r.grade)}</div></div>`;
  const footMsg = t.id==='kg' ? `${count(skillLv,3)} of ${t.skills.length} skills and ${count(unitLv,3)} of ${units.length} topics are Confident. Keep shining, ${esc(nick)}!`
                : t.id==='g13' ? `Lumi is proud of you, ${esc(nick)}! Keep shining.` : `Aim high and keep shining, ${esc(nick)}!`;
  const foot = (pg, total) => t.id==='kg'
    ? `<div class="foot"><span class="st1">★</span><i>${footMsg}</i><b>LittleLume English · Learn · Play · Shine</b><span class="st2">★</span></div>`
    : `<div class="foot"><span class="fl"><img src="${_prLogoSrc()}" alt=""></span><i>${footMsg}</i><b>LittleLume English · Learn · Play · Shine</b><span class="pg">Page ${pg} of ${total}</span></div>`;

  const scaleCards = (cols) => `<div class="scale" style="grid-template-columns:repeat(${cols},1fr)">${PR_LEVELS.map(l=>`
    <div class="sc" style="background:${LVBG(l.v)}"><div class="ic">${_prIcon(l.v,22)}</div><div><b>${l.name}</b><p>${t.scored?l.desc.replace(' menggunakan skill',''):l.desc}</p></div>
    ${t.scored?`<span class="rng" style="color:${_PR_LV_COL[l.v][2]}">${['Below 60','60 - 79','80 - 100'][l.v-1]}</span>`:_prBars(l.v)}</div>`).join('')}</div>`;

  const unitCards = units.length ? `<div class="units">${units.map((u,i)=>{
    const lv = unitLv[i]; const col=_PR_LV_COL[lv]||['#cbd5e1','#eef1f6','#8b93a7'];
    if(t.id==='kg') return `<div class="un" style="background:${LVBG(lv)}"><div class="top"><div class="ic">${_prIcon(lv||1,18)}</div><div><b>${esc(u.name)}</b><em style="color:${col[2]};margin-top:2px">${PR_LEVELS[lv-1]?.name||'Not rated'}</em></div></div></div>`;
    if(t.id==='g13') return `<div class="un" style="background:${LVBG(lv)}"><div class="top"><div class="ic">${_prIcon(lv||1,18)}</div><div><em style="color:${col[2]}">UNIT ${i+1} · ${(PR_LEVELS[lv-1]?.name||'Not rated').toUpperCase()}</em><b>${esc(u.name)}</b></div></div>${u.desc?`<p>${esc(u.desc)}</p>`:''}</div>`;
    return `<div class="un" style="background:${LVBG(lv)}"><div class="top"><div><em style="color:${col[2]}">UNIT ${i+1} · ${(PR_LEVELS[lv-1]?.name||'Not rated').toUpperCase()}</em><b>${esc(u.name)}</b></div><span class="sc2">${u.val!==''&&u.val!=null?esc(String(u.val)):'—'}</span></div><div class="pb"><i style="width:${Math.max(0,Math.min(100,+u.val||0))}%;background:${col[0]}"></i></div></div>`;
  }).join('')}</div>` : `<div style="font-size:11px;color:#8b93a7;padding:6px 2px">No ${t.unitWord.toLowerCase()} recorded for this period.</div>`;

  const NOTE_COL = { strengths:['#f2a900','#fff7dc','#d99400'], improve:['#f0645f','#ffe9e7','#e2554f'], speaking:['#7c6cf0','#efeafd','#6c5ce7'],
                     confidence:['#3b9ae1','#e3f1fc','#2f86c9'], next:['#2fae6e','#e2f5ea','#22955a'], home:['#e2457a','#fde8ef','#d63a6d'] };
  const notes = `<div class="notes">${t.notes.map(([k,n])=>{ const c=NOTE_COL[k]; const txt=String((r.notes||{})[k]||'');
    const body = k==='home' ? txt.split('\n').filter(x=>x.trim()).map(x=>'• '+esc(x.replace(/^[•\-*\s]+/,''))).join('<br>') : fill(txt);
    return `<div class="nt ${k==='next'&&t.id==='kg'?'full':''}" style="background:${c[1]};border-color:${c[0]}"><small style="color:${c[2]}">${n.toUpperCase()}</small><p>${body||'&nbsp;'}</p></div>`; }).join('')}</div>`;

  const snapRow = (label, arr) => {
    const segs = [1,2,3].map(l=>({l, n:count(arr,l)})).filter(x=>x.n);
    return `<div class="r"><b>${label} (${arr.length})</b><div class="seg">${segs.map(x=>`<div style="flex:${x.n};background:${LVBG(x.l)}">${_prIcon(x.l,12)}${x.n}</div>`).join('')||'<div style="flex:1;background:#eef1f6;color:#9aa3b5">—</div>'}</div></div>`;
  };
  const habits = t.habits ? `<div class="hab">${t.habits.map(([k,n],i)=>{ const lv=habitLv[i];
    return `<div class="hb" style="background:${LVBG(lv)}"><div class="t"><div class="ic">${_prIcon(lv||1,16)}</div>${n}</div><div class="l">${_prBars(lv)}${_prLvTxt(lv)}</div></div>`; }).join('')}</div>` : '';
  const parentBox = `<div class="parent"><div class="lbl"><i>♥</i>Note for Parents</div><div class="q">${fill(r.parentNote)}</div></div>`;

  let pages = [];
  if(t.id==='kg'){
    pages.push(`<div class="page">${header}<div class="body" style="padding-top:20px">
      <div style="display:grid;grid-template-columns:1.35fr 1fr;gap:20px">
        <div><div class="st">English Skills <span class="chip">KINDERGARTEN</span></div>
          <table><tr><th>SKILL</th><th style="width:150px">LEVEL</th></tr>${t.skills.map(([k,n],i)=>`<tr><td>${n}</td><td><div class="lvcell">${_prBars(skillLv[i])}${_prLvTxt(skillLv[i])}</div></td></tr>`).join('')}</table></div>
        <div><div class="st">Progress Scale</div>${scaleCards(1)}</div>
      </div>
      <div class="st" style="--d:#2ec4b6;margin-top:11px">${t.units}</div>${unitCards}
      <div class="st" style="--d:#f0645f;margin-top:11px">Teacher's Note</div>${notes}
      <div class="st" style="--d:#f2a900;margin-top:11px">LittleLume Growth Snapshot</div>
      <div class="snap">${snapRow('Skills',skillLv)}${snapRow('Topics',unitLv)}</div>
      <div class="pband" style="margin-top:11px"><div class="h">♥</div><div class="tt">Note for<br><span>Parents</span></div><p>${fill(r.parentNote)}</p></div>
    </div>${foot(1,1)}</div>`);
  } else if(t.id==='g13'){
    pages.push(`<div class="page">${header}<div class="body" style="padding-top:20px">
      <div class="st">Progress Scale</div>${scaleCards(3)}
      <div class="st" style="margin-top:12px">English Skills <span class="chip">${esc(r.grade).toUpperCase()}</span></div>
      <table><tr><th>SKILL &amp; CAN-DO STATEMENT</th><th style="width:190px">LEVEL</th></tr>${t.skills.map(([k,n,cd],i)=>`<tr><td style="padding:10px 18px"><b>${n}</b><small>${cd}</small></td><td><div class="lvcell">${_prBars(skillLv[i])}${_prLvTxt(skillLv[i])}</div></td></tr>`).join('')}</table>
      <div class="st" style="--d:#2ec4b6;margin-top:12px">${t.units}</div>${unitCards}
    </div>${foot(1,2)}</div>`);
    const ws = t.worksheet.map(([k,n])=>{ const v=(r.worksheet||{})[k]; const has=v!==''&&v!=null; const lv=has?prLevelFromScore(v*10):0; const col=(_PR_LV_COL[lv]||['#cbd5e1'])[0];
      return `<div class="bl"><b style="width:110px">${n}</b><div class="tr"><i style="width:${has?Math.min(100,v*10):0}%;background:${col}"></i></div><span>${has?esc(String(v)):'—'}/10</span></div>`; }).join('');
    pages.push(`<div class="page">${mini}<div class="body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div><div class="st" style="--d:#e2457a">Learning Habits</div>${habits}</div>
        <div><div class="st" style="--d:#f2a900">Learning Attitude</div><div class="att" style="height:calc(100% - 38px)"><small>TEACHER'S OBSERVATION</small><p>${fill(r.attitude)}</p></div></div>
      </div>
      <div class="st" style="--d:#3b9ae1;margin-top:11px">Worksheet Scores <span class="chip">OUT OF 10</span></div><div class="bar-list">${ws}</div>
      <div class="st" style="--d:#f2a900;margin-top:11px">LittleLume Growth Snapshot</div>
      <div class="snap">${snapRow('Skills',skillLv)}${snapRow('Units',unitLv)}${snapRow('Habits',habitLv)}</div>
      <div class="st" style="--d:#f0645f;margin-top:11px">Teacher's Note</div>${notes}
      <div style="margin-top:24px">${parentBox}</div>
    </div>${foot(2,2)}</div>`);
  } else {
    const scores = t.skills.map(([k])=>(r.skills||{})[k]).filter(v=>v!==''&&v!=null).map(Number);
    const overall = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const oLv = prLevelFromScore(overall);
    const att = prAttendance(r.siswaId, r.dari, r.sampai);
    const attLbl = att.pct===null ? '—' : att.pct>=90 ? 'Excellent' : att.pct>=75 ? 'Good' : 'Needs Attention';
    const ci = Math.max(0, PR_CEFR.findIndex(c=>c[0]===r.cefr));
    pages.push(`<div class="page">${header}<div class="body" style="padding-top:20px">
      <div class="sum3">
        <div class="sm">${_prDonut(overall||0,(_PR_LV_COL[oLv]||['#cbd5e1'])[0],overall??'—')}<div><small>OVERALL SCORE</small><b>${overall??'—'} / 100</b><em style="color:${(_PR_LV_COL[oLv]||['','','#8b93a7'])[2]}">${PR_LEVELS[oLv-1]?.name||'—'}</em></div></div>
        <div class="sm" style="flex-direction:column;align-items:flex-start;gap:6px"><small>ENGLISH LEVEL (CEFR)</small><div style="display:flex;align-items:center;gap:12px"><span class="cefr">${esc(PR_CEFR[ci][0])}</span><div><b style="font-size:13px">${esc(PR_CEFR[ci][1])}</b><div class="dots">${PR_CEFR.map((c,i)=>`${i?'<s></s>':''}<i style="${i===ci?'background:#f2a900;width:12px;height:12px':''}"></i>`).join('')}</div></div></div></div>
        <div class="sm">${_prDonut(att.pct||0,'#2fae6e',att.pct===null?'—':att.pct+'%')}<div><small>ATTENDANCE</small><b>${attLbl}</b><em style="color:#8b93a7;font-weight:600">${att.total?`Present ${att.present} of ${att.total} sessions`:'No records'}</em></div></div>
      </div>
      <div class="st" style="margin-top:12px">Progress Scale</div>${scaleCards(3)}
      <div class="st" style="margin-top:12px">English Skills <span class="chip">GRADE 4 - 6</span></div>
      <table><tr><th>SKILL &amp; CAN-DO STATEMENT</th><th style="width:170px">SCORE</th><th style="width:100px">LEVEL</th></tr>${t.skills.map(([k,n,cd],i)=>{ const v=(r.skills||{})[k]; const has=v!==''&&v!=null; const col=(_PR_LV_COL[skillLv[i]]||['#cbd5e1'])[0];
        return `<tr><td style="padding:10px 18px"><b>${n}</b><small>${cd}</small></td><td><div style="display:flex;align-items:center;gap:10px"><div style="flex:1;height:10px;border-radius:6px;background:#e8ecf3;overflow:hidden"><div style="height:100%;width:${has?Math.min(100,v):0}%;background:${col};border-radius:6px"></div></div><b style="width:24px">${has?esc(String(v)):'—'}</b></div></td><td>${_prLvTxt(skillLv[i])}</td></tr>`; }).join('')}</table>
      <div class="st" style="--d:#2ea6e6;margin-top:12px">${t.units}</div>${unitCards}
    </div>${foot(1,2)}</div>`);
    const tasks = String((r.pres||{}).tasks||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const rub = t.rubric.map(([k,n])=>{ const lv=+((r.pres||{})[k])||0; return `<div><span>${n}</span>${_prBars(lv)}${_prLvTxt(lv)}</div>`; }).join('');
    const sumBars = t.summary.map(([k,n])=>{ const v=(r.summary||{})[k]; const has=v!==''&&v!=null; const col=(_PR_LV_COL[prLevelFromScore(v)]||['#cbd5e1'])[0];
      return `<div class="bl"><b>${n}</b><div class="tr"><i style="width:${has?Math.min(100,v):0}%;background:${col}"></i></div><span>${has?esc(String(v)):'—'}/100</span></div>`; }).join('');
    pages.push(`<div class="page">${mini}<div class="body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div><div class="st" style="--d:#e2457a">Learning Habits</div>${habits}</div>
        <div><div class="st" style="--d:#f2a900">Learning Attitude</div><div class="att" style="height:calc(100% - 38px)"><small>TEACHER'S OBSERVATION</small><p>${fill(r.attitude)}</p></div></div>
      </div>
      <div class="st" style="--d:#2ea6e6;margin-top:11px">Score Summary <span class="chip">OUT OF 100 · THIS PERIOD</span></div><div class="bar-list">${sumBars}</div>
      <div class="st" style="--d:#7c3aed;margin-top:11px">Dialog &amp; Short Presentation</div>
      <div class="pres"><div class="ph"><div><small>LATEST SPEAKING TASKS</small><b>${tasks.length?tasks.map(esc).join(' &nbsp;·&nbsp; '):'—'}</b></div><em>RUBRIC ASSESSMENT</em></div><div class="pg2">${rub}</div></div>
      <div class="st" style="--d:#f0645f;margin-top:11px">Teacher's Note</div>${notes}
      <div style="margin-top:24px">${parentBox}</div>
    </div>${foot(2,2)}</div>`);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progress Report - ${esc(name)}</title>
    ${_PR_ASSETS && _PR_ASSETS.fontCSS ? `<style>${_PR_ASSETS.fontCSS}</style>` : (opt.noFonts?'':'<link href="'+_PR_FONT_URL+'" rel="stylesheet">')}
    <style>${_prCSS(th)}</style></head><body>${pages.join('')}
    <script>
      // Isi terlalu panjang → kecilkan sedikit agar tetap muat di atas footer
      function prFit(){ document.querySelectorAll('.page').forEach(function(p){
        var b=p.querySelector('.body'), f=p.querySelector('.foot'); if(!b||!f) return;
        var over=function(){ return b.scrollHeight > f.getBoundingClientRect().top-b.getBoundingClientRect().top-10; };
        b.style.transform=''; p.classList.remove('t1','t2');
        if(over()) p.classList.add('t1');
        if(over()){ p.classList.remove('t1'); p.classList.add('t2'); }
        if(over()){ var room=f.getBoundingClientRect().top-b.getBoundingClientRect().top-10, k=Math.max(0.8, room/b.scrollHeight);
          b.style.transformOrigin='top left'; b.style.width=(100/k)+'%'; b.style.transform='scale('+k.toFixed(3)+')'; }
      }); }
      prFit(); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(prFit); window.addEventListener('load', prFit);
    <\/script></body></html>`;
}

// ════════════════════════════════════════════════
//  VIEW / PRINT / PDF / WHATSAPP
// ════════════════════════════════════════════════
let _prViewId = null;
async function prView(id){
  const r = raporList.find(x=>x.id===id); if(!r) return;
  try{ await Promise.race([prLoadAssets(), new Promise(res=>setTimeout(res,4000))]); }catch(e){}
  _prViewId = id;
  let ov = document.getElementById('pr-viewer');
  if(!ov){
    ov = document.createElement('div'); ov.id='pr-viewer'; ov.className='pr-viewer';
    ov.innerHTML = `<div class="pr-viewer-box">
      <div class="pr-viewer-hd"><b id="pr-viewer-title"></b><button class="btn sm icon-only" onclick="prCloseView()" title="Close">✕</button></div>
      <div class="pr-viewer-body"><iframe id="pr-viewer-frame" title="Progress report preview"></iframe></div>
      <div class="pr-viewer-ft">
        <button class="btn wa" onclick="prShareWA()">💬 Send PDF via WhatsApp</button>
        <button class="btn primary" onclick="prDownloadPDF()">📄 Download PDF</button>
        <button class="btn" onclick="prPrint()">🖨️ Print</button>
        <button class="btn" onclick="prDownloadImages()">🖼️ Save as images</button>
        <button class="btn" onclick="prCloseView();prOpenForm('${id}')">✏️ Edit</button>
      </div>
      <div class="sb-status" id="pr-status" style="display:none"></div>
    </div>`;
    ov.addEventListener('click', e=>{ if(e.target===ov) prCloseView(); });
    document.body.appendChild(ov);
  }
  ov.querySelector('.pr-viewer-ft button:last-child').setAttribute('onclick', `prCloseView();prOpenForm('${id}')`);
  document.getElementById('pr-viewer-title').textContent = `📄 ${r.namaSiswa} · ${r.grade} · ${prPeriodLabel(r.dari,r.sampai)}`;
  document.getElementById('pr-status').style.display='none';
  const fr = document.getElementById('pr-viewer-frame');
  fr.srcdoc = buildProgressReportHTML(r);
  fr.onload = ()=>{ try{ const d=fr.contentDocument; d.body.style.background='#e9ecf3'; d.body.style.padding='14px 0'; _prFitFrame(); }catch(e){} };
  ov.classList.add('open');
  window.addEventListener('resize', _prFitFrame);
}
function _prFitFrame(){
  const fr = document.getElementById('pr-viewer-frame'); if(!fr) return;
  const w = fr.parentElement.clientWidth; const sc = Math.min(1, (w-8)/794);
  try{ fr.contentDocument.body.style.zoom = sc; }catch(e){}
}
function prCloseView(){ document.getElementById('pr-viewer')?.classList.remove('open'); window.removeEventListener('resize', _prFitFrame); }
function _prRec(){ return raporList.find(x=>x.id===_prViewId); }
function _prFileBase(r){ return `Progress-Report-${(r.namaSiswa||'Student').replace(/\s+/g,'-')}-${prPeriodLabel(r.dari,r.sampai).replace(/\s+/g,'')}`; }
function _prSay(html, hide){ const el=document.getElementById('pr-status'); if(!el) return; el.style.display='block'; el.innerHTML=html; if(hide) setTimeout(()=>el.style.display='none',hide); }

// Cetak dari PDF yang sama → hasil cetak identik di HP & laptop
// (cetak langsung dari HTML di HP sering menambah margin & memotong halaman).
async function prPrint(){
  const r=_prRec(); if(!r) return;
  const w = window.open('', '_blank');
  if(w) w.document.write('<p style="font-family:Arial,sans-serif;padding:24px;color:#555">⏳ Preparing the report for printing…</p>');
  _prSay('⏳ Preparing print…');
  try{
    const blob = await _prPdfBlob(r);
    const url = URL.createObjectURL(blob);
    if(w) w.location.href = url; else window.open(url,'_blank');
    setTimeout(()=>URL.revokeObjectURL(url), 120000);
    _prSay('✅ The PDF opened in a new tab — use its Print button.',6000);
  }catch(e){
    console.error(e);
    const html = buildProgressReportHTML(r) + `<script>window.onload=function(){setTimeout(function(){window.print()},700)}<\/script>`;
    const ww = w || window.open('', '_blank'); if(!ww){ showToast('Allow pop-ups to print.','warn'); return; }
    ww.document.open(); ww.document.write(html); ww.document.close();
    _prSay('',1);
  }
}
// Render tiap halaman A4 → canvas (iframe tersembunyi + html2canvas)
async function _prCanvases(r){
  if(typeof html2canvas!=='function') throw new Error('html2canvas not loaded');
  await prLoadAssets();
  try{
    await Promise.race([Promise.all(['400','500','600','700','800'].map(w=>document.fonts.load(w+' 14px Poppins')).concat([document.fonts.load('italic 14px Lora')])), new Promise(res=>setTimeout(res,4000))]);
  }catch(e){}
  const W=794, H=1123;
  const ifr=document.createElement('iframe'); ifr.setAttribute('aria-hidden','true');
  ifr.style.cssText=`position:fixed;left:-10000px;top:0;width:${W}px;height:${H}px;border:0;visibility:hidden`;
  document.body.appendChild(ifr);
  try{
    const doc=ifr.contentDocument; doc.open(); doc.write(buildProgressReportHTML(r)); doc.close();
    await new Promise(res=>{ if(doc.readyState==='complete') res(); else ifr.onload=()=>res(); setTimeout(res,3000); });
    try{
      await Promise.race([Promise.all(['400','500','600','700','800'].map(w=>doc.fonts.load(w+' 14px Poppins')).concat([doc.fonts.load('italic 14px Lora')])), new Promise(res=>setTimeout(res,4000))]);
      await Promise.race([doc.fonts.ready, new Promise(res=>setTimeout(res,3000))]);
    }catch(e){}
    const imgs=[...doc.images].filter(i=>!i.complete);
    await Promise.race([Promise.all(imgs.map(i=>new Promise(res=>{i.onload=i.onerror=res;}))), new Promise(res=>setTimeout(res,3000))]);
    try{ ifr.contentWindow.prFit && ifr.contentWindow.prFit(); }catch(e){}
    await new Promise(res=>setTimeout(res,120));
    doc.body.style.background='#fff';
    const out=[];
    for(const pg of doc.querySelectorAll('.page')){
      pg.style.margin='0';
      out.push(await html2canvas(pg,{scale:2,useCORS:true,backgroundColor:'#ffffff',width:W,height:H,windowWidth:W,windowHeight:H}));
    }
    return out;
  } finally { ifr.remove(); }
}
async function _prPdfBlob(r){
  const J = window.jspdf && window.jspdf.jsPDF; if(!J) throw new Error('jsPDF not loaded');
  const cs = await _prCanvases(r);
  const pdf = new J({ unit:'mm', format:'a4', orientation:'portrait', compress:true });
  cs.forEach((c,i)=>{ if(i) pdf.addPage(); pdf.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',0,0,210,297); });
  return pdf.output('blob');
}
async function prDownloadPDF(){
  const r=_prRec(); if(!r) return;
  _prSay('⏳ Creating PDF…');
  try{
    const blob = await _prPdfBlob(r);
    const a=document.createElement('a'); a.download=_prFileBase(r)+'.pdf'; a.href=URL.createObjectURL(blob); a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),10000);
    _prSay('✅ PDF downloaded.',4000);
  }catch(e){ console.error(e); _prSay('⚠️ Could not create the PDF here — use 🖨️ Print and choose "Save as PDF".'); }
}
async function prDownloadImages(){
  const r=_prRec(); if(!r) return;
  _prSay('⏳ Creating images…');
  try{
    const cs = await _prCanvases(r);
    for(let i=0;i<cs.length;i++){
      const a=document.createElement('a'); a.download=`${_prFileBase(r)}${cs.length>1?'-p'+(i+1):''}.jpg`; a.href=cs[i].toDataURL('image/jpeg',0.92); a.click();
      await new Promise(res=>setTimeout(res,350));
    }
    _prSay(`✅ ${cs.length} image(s) saved.`,4000);
  }catch(e){ console.error(e); _prSay('⚠️ Could not create images.'); }
}
async function prShareWA(){
  const r=_prRec(); if(!r) return;
  const s = siswaList.find(x=>x.id===r.siswaId) || {};
  const caption = `Assalamu'alaikum, here is the English progress report for *${r.namaSiswa}* (${prPeriodLabel(r.dari,r.sampai)}) from LittleLume English. Thank you for your support! 🌟`;
  _prSay('⏳ Preparing PDF…');
  try{
    const blob = await _prPdfBlob(r);
    const file = new File([blob], _prFileBase(r)+'.pdf', {type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({ files:[file], text:caption }); _prSay('✅ Shared. Choose the contact in WhatsApp, then send.',5000); return; }
      catch(e){ if(e.name==='AbortError'){ _prSay('',1); return; } }
    }
    const a=document.createElement('a'); a.download=file.name; a.href=URL.createObjectURL(file); a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),10000);
    let copied=false; try{ await navigator.clipboard.writeText(caption); copied=true; }catch(e){}
    const hp=(s.hp||'').replace(/\D/g,'');
    window.open(hp ? 'https://wa.me/'+(hp.startsWith('62')?hp:'62'+hp.replace(/^0/,'')) : 'https://wa.me/','_blank');
    _prSay(copied ? '✅ PDF saved & message copied → in WhatsApp tap 📎, pick the PDF, <b>paste</b> the message, send.' : '✅ PDF saved → in WhatsApp tap 📎 and pick the PDF.', 10000);
  }catch(e){ console.error(e); _prSay('⚠️ Could not create the PDF — use 🖨️ Print → Save as PDF, then send it.'); }
}

// Segarkan daftar rapor bersama halaman Evaluation
if(typeof renderEval==='function'){
  const _prOrigRenderEval = renderEval;
  renderEval = function(){ const out=_prOrigRenderEval.apply(this, arguments); try{ if(typeof _currentEvalTab!=='undefined' && _currentEvalTab==='report') renderProgressReports(); }catch(e){} return out; };
}
