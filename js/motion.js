// ════════════════════════════════════════════════
//  MOTION — efek kecil yang butuh JavaScript
//    • riak (ripple) saat menu/tombol diklik
//    • angka di kartu statistik "menghitung naik"
//  Mati otomatis bila perangkat diatur "kurangi gerakan".
// ════════════════════════════════════════════════
(function(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;

  // ── Ripple ──
  document.addEventListener('pointerdown', e=>{
    const el = e.target.closest('.nav-item, .mbn-item');
    if(!el) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'm-ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
    if(getComputedStyle(el).position==='static') el.style.position='relative';
    el.appendChild(dot);
    setTimeout(()=>dot.remove(), 650);
  }, { passive:true });

  // ── Count-up angka kartu statistik ──
  const fmtID = n => Math.round(n).toLocaleString('id-ID');
  function countUp(valEl){
    const node = [...valEl.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
    if(!node || valEl.dataset.counted===node.textContent) return;
    const m = node.textContent.match(/^(\s*(?:Rp\s?)?)([\d.]+)(\s*)$/);
    if(!m) return;
    const target = +m[2].replace(/\./g,'');
    if(!isFinite(target) || target===0) return;
    const prefix = m[1], suffix = m[3], dur = 900, t0 = performance.now();
    const step = now=>{
      const p = Math.min(1,(now-t0)/dur), eased = 1-Math.pow(1-p,3);
      node.textContent = prefix + fmtID(target*eased) + suffix;
      if(p<1) requestAnimationFrame(step);
      else valEl.dataset.counted = node.textContent;
    };
    requestAnimationFrame(step);
  }
  const animateIn = root => root.querySelectorAll('.stat-card .val').forEach(countUp);
  const mo = new MutationObserver(muts=>{
    const roots = new Set();
    muts.forEach(m=>{ const host = m.target.closest ? m.target.closest('.card-grid, #ov-body') : null; if(host) roots.add(host); });
    roots.forEach(animateIn);
  });
  const start = ()=>{
    mo.observe(document.querySelector('.page-content') || document.body, { childList:true, subtree:true });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
