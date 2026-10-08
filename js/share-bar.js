// ════════════════════════════════════════════════
//  SHARE BAR — satu pola tombol untuk semua fitur kirim WA / print
//  [ 💬 Send via WhatsApp ] [ 🖨️ ] [ ⋯ ]  + menu ⋯ untuk opsi lain
// ════════════════════════════════════════════════
/**
 * cfg = {
 *   wa:    'kode onclick'               → tombol hijau utama
 *   waLabel (opsional)                  → default 'Send via WhatsApp'
 *   print: 'kode onclick' (opsional)    → tombol ikon 🖨️
 *   more:  [[ikon, label, 'onclick'], …] → isi menu ⋯
 *   status: id elemen status (opsional)
 * }
 */
function shareBarHTML(cfg){
  const more = (cfg.more||[]).filter(Boolean);
  const menuId = 'sbm-' + Math.random().toString(36).slice(2,8);
  return `
    <div class="share-bar">
      ${cfg.wa ? `<button class="btn wa sb-main" ${cfg.waId?`id="${cfg.waId}"`:''} onclick="${cfg.wa}">💬 ${cfg.waLabel||'Send via WhatsApp'}</button>` : ''}
      ${cfg.primary ? `<button class="btn primary sb-main" onclick="${cfg.primary[2]}">${cfg.primary[0]} ${cfg.primary[1]}</button>` : ''}
      ${cfg.print ? `<button class="btn sb-icon" onclick="${cfg.print}" title="Print">🖨️</button>` : ''}
      ${more.length ? `
      <div class="sb-more">
        <button class="btn sb-icon" onclick="toggleShareMenu('${menuId}',event)" title="More options">⋯</button>
        <div class="sb-menu" id="${menuId}">
          ${more.map(([ico,label,fn])=>`<button onclick="closeShareMenus();${fn}"><span class="sb-ico">${ico}</span>${label}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>
    ${cfg.status ? `<div class="sb-status" id="${cfg.status}"></div>` : ''}`;
}
function mountShareBar(elId, cfg){
  const el = document.getElementById(elId);
  if(el) el.innerHTML = shareBarHTML(cfg);
}
function toggleShareMenu(id, ev){
  if(ev) ev.stopPropagation();
  const m = document.getElementById(id); if(!m) return;
  const willOpen = !m.classList.contains('open');
  closeShareMenus();
  if(willOpen) m.classList.add('open');
}
function closeShareMenus(){ document.querySelectorAll('.sb-menu.open').forEach(m=>m.classList.remove('open')); }
document.addEventListener('click', e=>{ if(!e.target.closest('.sb-more')) closeShareMenus(); });

// ── Kirim gambar + caption ke WhatsApp (dipakai dokumen eval / lesson / report) ──
// Web Share (HP): gambar + teks satu pesan. Desktop: download gambar, copy caption, buka chat WA.
let _sbPending = null;
async function shareImageToWA(canvas, filename, caption, phone, statusEl){
  const say = (html, hide)=>{ if(!statusEl) return; statusEl.style.display='block'; statusEl.innerHTML=html; if(hide) setTimeout(()=>statusEl.style.display='none',hide); };
  const blob = await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('toBlob failed')),'image/jpeg',0.92));
  const file = new File([blob], filename+'.jpg', {type:'image/jpeg'});
  _sbPending = { file, caption, phone:(phone||'').replace(/\D/g,''), say };
  if(navigator.canShare && navigator.canShare({files:[file]})) return _sbShareNow();
  return _sbFallback();
}
async function _sbShareNow(){
  const c=_sbPending; if(!c) return;
  try{
    await navigator.share({ files:[c.file], text:c.caption });
    c.say('✅ Shared. Choose the contact in WhatsApp, then send.', 4000);
  }catch(e){
    if(e.name==='AbortError'){ c.say('',1); return; }
    if(e.name==='NotAllowedError'){ c.say('✅ Image ready. <button class="btn wa sm" onclick="_sbShareNow()">📤 Share to WhatsApp</button>'); return; }
    return _sbFallback();
  }
}
async function _sbFallback(){
  const c=_sbPending; if(!c) return;
  const a=document.createElement('a'); a.download=c.file.name; a.href=URL.createObjectURL(c.file); a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  let copied=false; try{ await navigator.clipboard.writeText(c.caption); copied=true; }catch(e){}
  await new Promise(r=>setTimeout(r,500));
  window.open(c.phone?`https://wa.me/62${c.phone.replace(/^0/,'')}`:'https://wa.me/','_blank');
  c.say(copied
    ? '✅ Image saved & caption copied → in WhatsApp tap 📎, pick the image, <b>paste</b> the caption, send.'
    : '✅ Image saved → in WhatsApp tap 📎 and pick the image.', 9000);
}

// ── Pasang share bar di modal-modal statis ──
function _mountStaticShareBars(){
  ['eval','lesson','report'].forEach(t=>mountShareBar('sb-doc-'+t, {
    wa:`docWaImage('${t}')`, print:`docPrint('${t}')`, status:'doc-status-'+t,
    more:[
      ['💬','Send as text only',`docWaText('${t}')`],
      ['🖼️','Save as image',`docDownloadJPG('${t}')`],
      ['📄','Save as PDF',`docDownloadPDF('${t}')`],
      ['📋','Copy text',`docCopyText('${t}')`],
    ],
  }));
  mountShareBar('sb-receipt', {
    wa:'waImage()', waId:'btn-wa-img', print:'printReceipt()', status:'wa-status',
    more:[
      ['💬','Send as text only','waText()'],
      ['🖼️','Save as image','downloadPNG()'],
      ['📄','Save as PDF','downloadPDF()'],
      ['📋','Copy text','copyReceipt()'],
    ],
  });
  mountShareBar('sb-profile', {
    wa:"exportSP('wa')",
    more:[
      ['🖼️','Save as image',"exportSP('png')"],
      ['📄','Save as PDF',"exportSP('pdf')"],
    ],
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _mountStaticShareBars);
else _mountStaticShareBars();
