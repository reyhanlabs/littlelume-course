// ════════════════════════════════════════════════
//  VERSI APLIKASI & WHAT'S NEW
// ────────────────────────────────────────────────
//  Setiap kali ada perubahan:
//    1. Naikkan APP_VERSION
//         x.y.Z → perbaikan bug kecil
//         x.Y.0 → fitur baru / perubahan alur
//         X.0.0 → perubahan besar (struktur data, tampilan total)
//    2. Tambahkan entri BARU di PALING ATAS CHANGELOG (versi sama dengan APP_VERSION)
//  Pengguna otomatis melihat popup "What's New" sekali setelah versi berubah.
// ════════════════════════════════════════════════
const APP_VERSION = '1.6.0';

// type: 'new' = fitur baru · 'improve' = peningkatan · 'fix' = perbaikan bug · 'security' = keamanan
const CHANGELOG = [
  {
    version: '1.6.0', date: '2026-10-01',
    title: 'Version info & What\'s New',
    items: [
      ['new', 'App version is shown at the bottom of the sidebar — tap it to see the full update history.'],
      ['new', 'After every update, a "What\'s New" summary appears once.'],
      ['improve', 'Backup files now record the app version they were made with.'],
    ],
  },
  {
    version: '1.5.0', date: '2026-10-01',
    title: 'Delete unused deposit',
    items: [
      ['new', 'Deposits list: 🗑️ button per student removes the unused deposit balance.'],
      ['new', 'Deposit history: each top-up is labelled Unused / Used / Used Rp X.'],
      ['improve', 'A partly used top-up (e.g. Rp 500.000, used Rp 200.000) can have just its unused part removed.'],
      ['improve', 'Fully used deposits cannot be deleted — a warning shows which payments used them.'],
    ],
  },
  {
    version: '1.4.1', date: '2026-10-01',
    title: 'Fixes',
    items: [
      ['fix', 'Payment form: session labels now show "Paid in this payment", "Will be paid", or "Will be removed" instead of always "Not yet paid".'],
      ['fix', 'Notification panel safely shows student names containing special characters.'],
    ],
  },
  {
    version: '1.4.0', date: '2026-09-30',
    title: 'Safer sync, backup & offline',
    items: [
      ['improve', 'Two devices editing at the same time no longer overwrite each other — changes are merged automatically.'],
      ['improve', 'Unsaved changes retry automatically when the connection returns.'],
      ['improve', 'Restore Backup checks the file first and downloads a safety copy of current data before replacing it.'],
      ['security', 'Text containing HTML/code (in names, notes) is displayed as plain text and never executed.'],
      ['improve', 'Faster tables for large classes.'],
      ['improve', 'The app opens properly while offline.'],
      ['fix', 'CSV export opens correctly in Excel (Indonesian settings, special characters).'],
    ],
  },
  {
    version: '1.3.0', date: '2026-09-30',
    title: 'Security',
    items: [
      ['security', 'Database locked: only registered teacher emails can read or change data.'],
      ['security', 'Access check no longer lets anyone in when the check fails.'],
      ['improve', 'Logo loaded from the app itself (sharper receipts).'],
    ],
  },
  {
    version: '1.2.0', date: '2026-09-30',
    title: 'Payments & data safety',
    items: [
      ['improve', 'Payment status is set automatically from amount paid vs invoice; overpayment is blocked.'],
      ['new', 'Monthly installments: several partial payments for the same month add up to Paid.'],
      ['new', 'Multi-month periods, e.g. "July - October 2026".'],
      ['fix', 'Re-sent receipts show the deposit balance at the time of the transaction, not today\'s.'],
      ['fix', 'Dates entered after midnight no longer shift to the previous day.'],
      ['fix', 'A failed data load or switching class mid-save can no longer erase data.'],
    ],
  },
  {
    version: '1.1.0', date: '2026-09-30',
    title: 'WhatsApp receipts',
    items: [
      ['new', 'Send receipts to WhatsApp as an image with a caption in one message.'],
      ['new', '💬 WA button directly in the payment list and deposit history.'],
    ],
  },
  {
    version: '1.0.0', date: '2026-08-30',
    title: 'First release',
    items: [
      ['new', 'Students, attendance, lessons, evaluations, payments, deposits, parent reports, analytics and backup.'],
    ],
  },
];

// ── helpers ──
function _cmpVersion(a, b){
  const pa = String(a||'0').split('.').map(Number), pb = String(b||'0').split('.').map(Number);
  for(let i=0;i<3;i++){ const d=(pa[i]||0)-(pb[i]||0); if(d) return d>0?1:-1; }
  return 0;
}
const _CL_TYPE = {
  new:      { label:'NEW',      color:'var(--green)',  bg:'rgba(67,233,123,0.13)' },
  improve:  { label:'IMPROVED', color:'var(--accent)', bg:'rgba(108,99,255,0.13)' },
  fix:      { label:'FIX',      color:'var(--yellow)', bg:'rgba(255,179,71,0.15)' },
  security: { label:'SECURITY', color:'var(--red)',    bg:'rgba(255,101,132,0.13)' },
};
function _clDate(iso){
  try{ return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  catch(e){ return iso; }
}
function _renderReleases(list){
  return list.map(r=>`
    <div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px">
        <div style="font-weight:800;color:var(--text)">v${r.version} <span style="font-weight:600;color:var(--muted)">· ${r.title}</span></div>
        <div style="font-size:0.75rem;color:var(--muted);white-space:nowrap">${_clDate(r.date)}</div>
      </div>
      ${r.items.map(([t,txt])=>{ const c=_CL_TYPE[t]||_CL_TYPE.improve; return `
        <div style="display:flex;gap:8px;align-items:flex-start;margin:5px 0;font-size:0.84rem;line-height:1.4;text-align:left">
          <span style="flex-shrink:0;font-size:0.62rem;font-weight:800;letter-spacing:.4px;color:${c.color};background:${c.bg};padding:2px 6px;border-radius:6px;margin-top:1px">${c.label}</span>
          <span style="color:var(--text)">${txt}</span>
        </div>`; }).join('')}
    </div>`).join('');
}

// ── Modal ──
function showChangelog(onlyNewSince){
  const list = onlyNewSince
    ? CHANGELOG.filter(r=>_cmpVersion(r.version, onlyNewSince) > 0)
    : CHANGELOG;
  if(!list.length) return;
  const id = 'modal-dialog-changelog';
  document.getElementById(id)?.remove();
  const heading = onlyNewSince ? `✨ What's New in v${APP_VERSION}` : '📜 Update History';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="overlay open" id="${id}" onclick="if(event.target===this) closeModalDialog('${id}')">
      <div class="modal" style="max-width:520px">
        <div class="modal-title">${heading}</div>
        <div style="font-size:0.78rem;color:var(--muted);margin:-4px 0 6px">LittleLume English Course · version ${APP_VERSION}</div>
        <div style="max-height:60vh;overflow-y:auto;padding-right:4px">${_renderReleases(list)}</div>
        <div class="modal-footer" style="justify-content:space-between">
          ${onlyNewSince ? `<button class="btn secondary sm" onclick="closeModalDialog('${id}');setTimeout(()=>showChangelog(),320)">Full history</button>` : '<span></span>'}
          <button class="btn primary" onclick="closeModalDialog('${id}')">Got it</button>
        </div>
      </div>
    </div>`);
  _markVersionSeen();
}

// ── Tampil otomatis sekali setelah update ──
function _lastSeenVersion(){ try{ return localStorage.getItem('appVersionSeen'); }catch(e){ return null; } }
function _markVersionSeen(){
  try{ localStorage.setItem('appVersionSeen', APP_VERSION); }catch(e){}
  document.getElementById('app-version-dot')?.style.setProperty('display','none');
}
function checkWhatsNew(){
  const seen = _lastSeenVersion();
  if(seen === APP_VERSION) return;
  // Pengguna lama yang belum pernah melihat: tampilkan rilis terbaru saja (bukan seluruh riwayat)
  const since = seen || (CHANGELOG[1]?.version || '0.0.0');
  showChangelog(since);
}

// ── Label versi di sidebar ──
function renderAppVersion(){
  const el = document.getElementById('app-version');
  if(!el) return;
  const unseen = _lastSeenVersion() !== APP_VERSION;
  el.innerHTML = `v${APP_VERSION} · What's new
    <span id="app-version-dot" style="display:${unseen?'inline-block':'none'};width:7px;height:7px;border-radius:50%;background:var(--red);margin-left:4px;vertical-align:middle"></span>`;
}
document.addEventListener('DOMContentLoaded', renderAppVersion);
if(document.readyState !== 'loading') renderAppVersion();
