// ════════════════════════════════════════════════
//  CETAKAN LESSON PLAN (A4) — satu desain untuk:
//    • Print / PDF dari halaman Lessons   (docPrint('lesson'))
//    • Print rencana sesi kurikulum       (curPrintMeeting)
//  Lesson yang terhubung ke kurikulum otomatis memakai rencana sesi lengkap.
// ════════════════════════════════════════════════

// Menit dari teks waktu: "3'", "10 min", "5-7 menit" → angka (ambil angka pertama)
function _lpMinutes(t){ const m = String(t||'').match(/\d+/); return m ? +m[0] : 0; }

function _lpTargetName(target){
  if(!target || target==='Semua') return 'All Students';
  const s = (typeof siswaList!=='undefined' ? siswaList : []).find(x=>x.id===target);
  return s ? s.nama : target;
}

/**
 * d = {
 *   title, topic, date, status, className, target, reference,
 *   grade, semester, session, duration,
 *   objectives[], grammar{pattern,example,note}, vocab[], media[],
 *   activities[{waktu,kegiatan,deskripsi}], assessment[], description
 * }
 */
function buildLessonPlanPrintHTML(d){
  const e = v => esc(v==null?'':String(v));
  const list = arr => (arr||[]).filter(Boolean);
  const acts = list(d.activities);
  const totalMin = acts.reduce((t,a)=>t+_lpMinutes(a.waktu),0);
  const info = [
    ['Class',     d.className],
    ['Grade',     [d.grade, d.semester?('Semester '+d.semester):''].filter(Boolean).join(' · ')],
    ['Session',   d.session],
    ['Date',      d.date],
    ['Duration',  d.duration || (totalMin ? totalMin+' minutes' : '')],
    ['Students',  d.target],
  ].filter(r=>r[1]);
  let n = 0; const sec = (title, body, keep=true) => body ? `
    <section class="sec${keep?' keep':''}">
      <h2><span class="num">${++n}</span>${title}</h2>
      ${body}
    </section>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>${e(d.title||'Lesson Plan')}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap">
  <style>
    @page { size:A4; margin:12mm 13mm 14mm }
    *{ box-sizing:border-box; margin:0; padding:0 }
    html{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
    body{ font-family:'Nunito',Arial,sans-serif; color:#1f2340; font-size:10.5pt; line-height:1.45; background:#fff }
    .page{ max-width:184mm; margin:0 auto }
    h1,h2,.brand{ font-family:'Fredoka','Nunito',Arial,sans-serif }

    /* Header */
    .head{ display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:14px;
           background:linear-gradient(120deg,#fdf2f8 0%,#eef2ff 55%,#ecfdf5 100%); border:1px solid #e9e7fb }
    .head img{ width:52px; height:52px; border-radius:50%; background:#fff; border:2px solid #f9c6dd; object-fit:contain }
    .brand{ font-size:15pt; font-weight:700; line-height:1.1 }
    .brand .p{ color:#e5488f } .brand .t{ color:#0f9f8f }
    .brand small{ display:block; font-family:'Nunito',Arial,sans-serif; font-size:8.5pt; font-weight:700; color:#6b7090; letter-spacing:.3px }
    .doc-type{ margin-left:auto; text-align:right }
    .doc-type b{ display:block; font-family:'Fredoka',Arial,sans-serif; font-size:13pt; color:#5b52e8; letter-spacing:1.5px }
    .doc-type span{ font-size:8.5pt; color:#6b7090; font-weight:700 }

    /* Judul topik */
    .topic{ margin:14px 2px 10px }
    .topic h1{ font-size:18pt; line-height:1.15; color:#1f2340 }
    .topic .ref{ margin-top:3px; font-size:8.5pt; color:#6b7090; font-weight:600 }

    /* Info grid */
    .info{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:6px }
    .info div{ border:1px solid #e7e8f2; border-radius:9px; padding:6px 10px; background:#fafbff }
    .info span{ display:block; font-size:7pt; font-weight:800; text-transform:uppercase; letter-spacing:.7px; color:#8a8fae }
    .info b{ font-size:9.5pt }

    /* Section */
    .sec{ margin-top:12px }
    .sec.keep{ break-inside:avoid; page-break-inside:avoid }
    .sec h2{ display:flex; align-items:center; gap:8px; font-size:11.5pt; color:#5b52e8; margin-bottom:6px;
             padding-bottom:4px; border-bottom:2px solid #eeedfd; break-after:avoid; page-break-after:avoid }
    .num{ display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%;
          background:#5b52e8; color:#fff; font-size:9pt }
    .checks{ list-style:none }
    .checks li{ position:relative; padding:2px 0 2px 22px }
    .checks li::before{ content:''; position:absolute; left:2px; top:5px; width:11px; height:11px; border:1.6px solid #9aa0c3; border-radius:3px }
    .bullets{ padding-left:18px } .bullets li{ padding:1px 0 }
    .grammar{ border-left:4px solid #0f9f8f; background:#effaf8; border-radius:0 10px 10px 0; padding:8px 12px }
    .grammar .pat{ font-family:'Fredoka',Arial,sans-serif; font-size:12pt; color:#0b6f64 }
    .grammar .ex{ font-style:italic; margin-top:2px }
    .grammar .note{ font-size:9pt; color:#5c6180; margin-top:3px }
    .chips{ display:flex; flex-wrap:wrap; gap:5px; align-items:flex-start; align-content:flex-start }
    .chips span{ border:1px solid #f5c2da; background:#fff5fa; color:#a3245f; border-radius:20px; padding:1px 9px; font-weight:700; font-size:9pt }
    .two{ display:grid; grid-template-columns:1fr 1fr; gap:14px }
    .desc{ white-space:pre-line; background:#fafbff; border:1px solid #e7e8f2; border-radius:10px; padding:10px 12px }

    /* Tabel aktivitas */
    table{ width:100%; border-collapse:separate; border-spacing:0; border:1px solid #e1e3f0; border-radius:10px; overflow:hidden }
    th{ background:#5b52e8; color:#fff; font-size:8pt; text-transform:uppercase; letter-spacing:.6px; text-align:left; padding:6px 8px }
    td{ padding:6px 8px; border-top:1px solid #eceef6; vertical-align:top }
    tr{ page-break-inside:avoid }
    tbody tr:nth-child(even) td{ background:#fafbff }
    td.time{ width:54px; font-weight:800; color:#5b52e8; white-space:nowrap }
    td.act{ width:130px; font-weight:800 }
    td.chk{ width:26px; text-align:center }
    td.chk i{ display:inline-block; width:12px; height:12px; border:1.6px solid #9aa0c3; border-radius:3px }
    tbody tr.total td{ background:#f3f2ff; font-weight:800; font-size:9pt }

    /* Catatan guru */
    .lines div{ border-bottom:1px dashed #c9cce0; height:22px }
    .notes-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px }
    .foot{ margin-top:16px; display:flex; justify-content:space-between; align-items:flex-end; font-size:8pt; color:#8a8fae;
           border-top:1px solid #eceef6; padding-top:8px; page-break-inside:avoid }
    .sign{ text-align:center; color:#1f2340; font-size:9pt }
    .sign div{ width:160px; border-bottom:1px solid #1f2340; height:40px; margin-bottom:3px }
    @media screen{ body{ background:#eef0f6; padding:20px } .page{ background:#fff; padding:14mm; box-shadow:0 8px 30px rgba(0,0,0,.12); border-radius:6px } }
    body.img{ background:#fff; padding:0 } body.img .page{ box-shadow:none; border-radius:0; padding:28px 30px 22px; max-width:none }
    body.img td.chk, body.img th:last-child{ display:none }   /* kolom ✓ hanya untuk cetakan */
  </style></head><body class="${d.forImage?'img':''}"><div class="page">

  <div class="head">
    <img src="${e(typeof APP_LOGO_URL!=='undefined'?APP_LOGO_URL:'')}" alt="">
    <div class="brand"><span class="p">Little</span><span class="t">Lume</span> <span class="p">English</span> <span class="t">Course</span>
      <small>Learn · Play · Shine</small></div>
    <div class="doc-type"><b>LESSON PLAN</b><span>${e(d.status||'')}</span></div>
  </div>

  <div class="topic">
    <h1>${e(d.topic)}</h1>
    ${d.reference?`<div class="ref">📎 ${e(d.reference)}</div>`:''}
  </div>

  <div class="info">${info.map(([k,v])=>`<div><span>${k}</span><b>${e(v)}</b></div>`).join('')}</div>

  ${sec('Learning Objectives', list(d.objectives).length ? `<ul class="checks">${list(d.objectives).map(x=>`<li>${e(x)}</li>`).join('')}</ul>` : '')}

  ${(d.grammar && d.grammar.pattern) || list(d.vocab).length ? sec('Language Focus', `
    <div class="two">
      ${d.grammar && d.grammar.pattern ? `<div class="grammar">
        <div class="pat">${e(d.grammar.pattern)}</div>
        ${d.grammar.example?`<div class="ex">“${e(d.grammar.example)}”</div>`:''}
        ${d.grammar.note?`<div class="note">${e(d.grammar.note)}</div>`:''}
      </div>` : '<div></div>'}
      ${list(d.vocab).length ? `<div class="chips">${list(d.vocab).map(v=>`<span>${e(v)}</span>`).join('')}</div>` : ''}
    </div>`) : ''}

  ${sec('Media & Materials', list(d.media).length ? `<ul class="bullets">${list(d.media).map(x=>`<li>${e(x)}</li>`).join('')}</ul>` : '')}

  ${sec(acts.length ? 'Lesson Activities' : 'Lesson Notes & Activities', acts.length ? `
    <table>
      <thead><tr><th>Time</th><th>Stage</th><th>What happens</th><th>✓</th></tr></thead>
      <tbody>${acts.map(a=>`<tr><td class="time">${e(a.waktu)}</td><td class="act">${e(a.kegiatan)}</td><td>${e(a.deskripsi)}</td><td class="chk"><i></i></td></tr>`).join('')}
      ${totalMin?`<tr class="total"><td class="time">${totalMin}'</td><td colspan="3">Total time</td></tr>`:''}</tbody>
    </table>` : (d.description ? `<div class="desc">${e(d.description)}</div>` : ''), false)}

  ${sec('Assessment', list(d.assessment).length ? `<ul class="checks">${list(d.assessment).map(x=>`<li>${e(x)}</li>`).join('')}</ul>` : '')}

  ${acts.length && d.description && !d.fromCurriculum ? sec('Notes', `<div class="desc">${e(d.description)}</div>`) : ''}

  ${d.forImage ? '' : sec('Teacher Notes', `
    <div class="notes-grid">
      <div><b style="font-size:9pt;color:#5c6180">What went well</b><div class="lines"><div></div><div></div><div></div></div></div>
      <div><b style="font-size:9pt;color:#5c6180">Follow up next session</b><div class="lines"><div></div><div></div><div></div></div></div>
    </div>`)}

  ${d.forImage ? `<div class="foot" style="justify-content:center">LittleLume English Course 🎓</div>` : `
  <div class="foot">
    <div>LittleLume English Course · printed ${e(tglFmt(todayISO()))}</div>
    <div class="sign"><div></div>Teacher</div>
  </div>`}

  </div></body></html>`;
}

// Data cetak dari sesi kurikulum
function _lpFromCurriculum(r, extra){
  const m = r.m;
  return Object.assign({
    title: `${m.num} - ${m.title}`,
    topic: `${m.num}: ${m.title}`,
    grade: (typeof CUR_GRADES!=='undefined' && CUR_GRADES[r.grade]) || r.grade,
    semester: r.sem, session: m.num, duration: m.duration,
    className: typeof currentClassName!=='undefined' ? currentClassName : '',
    target: 'All Students',
    reference: 'LittleLume Curriculum',
    objectives: m.objectives, vocab: m.vocab, media: m.media, activities: m.activities, assessment: m.assessment,
    grammar: { pattern:m.grammarPattern, example:m.grammarExample, note:m.grammarNote },
    fromCurriculum: true,
  }, extra||{});
}

// Data cetak dari lesson (materiList)
function lessonPrintData(m){
  const base = {
    title: 'Lesson-' + (m.topik||'').replace(/\s+/g,'-').slice(0,40),
    topic: m.topik, date: tglFmt(m.tanggal),
    status: m.status==='Selesai' ? 'Completed' : 'Planned',
    className: typeof currentClassName!=='undefined' ? currentClassName : '',
    target: _lpTargetName(m.target),
    reference: m.sumber, description: m.deskripsi,
  };
  const r = (m.kurikulum && typeof curGetMeeting==='function') ? curGetMeeting(m.kurikulum) : null;
  return r ? _lpFromCurriculum(r, { ...base, topic: m.topik || `${r.m.num}: ${r.m.title}` }) : base;
}

function openLessonPlanPrint(d, delay){
  const w = window.open('', '_blank'); if(!w) return;
  w.document.write(buildLessonPlanPrintHTML(d) +
    `<script>window.onload=function(){setTimeout(function(){window.print()},${delay||500})}<\/script>`);
  w.document.close();
}

// ── Gambar (JPG/WA) dengan desain yang sama dengan cetakan ──
// Dirender di iframe tersembunyi selebar A4 (794px) lalu difoto dengan html2canvas.
async function renderLessonPlanCanvas(d){
  const W = 794;
  const ifr = document.createElement('iframe');
  ifr.setAttribute('aria-hidden','true');
  ifr.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:400px;border:0;visibility:hidden`;
  document.body.appendChild(ifr);
  try{
    const doc = ifr.contentDocument;
    doc.open(); doc.write(buildLessonPlanPrintHTML({ ...d, forImage:true })); doc.close();
    await new Promise(r=>{ if(doc.readyState==='complete') r(); else ifr.onload=()=>r(); setTimeout(r,2500); });
    try{ await Promise.race([doc.fonts.ready, new Promise(r=>setTimeout(r,1500))]); }catch(e){}
    const imgs=[...doc.images].filter(i=>!i.complete);
    await Promise.race([Promise.all(imgs.map(i=>new Promise(r=>{i.onload=i.onerror=r;}))), new Promise(r=>setTimeout(r,2000))]);
    const H = Math.ceil(doc.querySelector('.page').getBoundingClientRect().height);
    ifr.style.height = H+'px';
    return await html2canvas(doc.body, { scale:2, useCORS:true, backgroundColor:'#ffffff', width:W, height:H, windowWidth:W, windowHeight:H });
  } finally {
    ifr.remove();
  }
}
