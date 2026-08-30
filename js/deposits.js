// ════════════════════════════════════════════════════════════════════
// DEPOSITS / UANG MUKA
// ────────────────────────────────────────────────────────────────────
// Per-class student wallet:
//   depositList entry: { id, siswaId, namaSiswa, tanggal, jumlah,
//                        tipe:'topup'|'refund', metode, catatan }
//   bayarList[i].depositUsed = nominal drawn from balance for that payment
//
// Balance(siswaId) = Σ topup − Σ refund − Σ depositUsed
// ════════════════════════════════════════════════════════════════════

// ─── Balance helpers ────────────────────────────────────────────────
function getDepositTopups(siswaId){
  return depositList.filter(d=>d.siswaId===siswaId && d.tipe==='topup')
                    .reduce((s,d)=>s+(+d.jumlah||0),0);
}
function getDepositRefunds(siswaId){
  return depositList.filter(d=>d.siswaId===siswaId && d.tipe==='refund')
                    .reduce((s,d)=>s+(+d.jumlah||0),0);
}
function getDepositUsed(siswaId, excludeBayarId=null){
  return bayarList.filter(b=>b.siswaId===siswaId && b.id!==excludeBayarId)
                  .reduce((s,b)=>s+(+b.depositUsed||0),0);
}
/**
 * Sisa saldo deposit untuk siswa.
 * @param {string} siswaId
 * @param {string|null} excludeBayarId  Saat edit payment, kecualikan record ini
 *                                       dari perhitungan "used" — supaya user
 *                                       bisa menaikkan/menurunkan depositUsed
 *                                       tanpa dianggap saldo tak cukup.
 */
function getDepositBalance(siswaId, excludeBayarId=null){
  return getDepositTopups(siswaId)
       - getDepositRefunds(siswaId)
       - getDepositUsed(siswaId, excludeBayarId);
}

// ─── Main page render ───────────────────────────────────────────────
function renderDeposits(){
  // Stats
  const statsEl = document.getElementById('deposit-stats');
  if(statsEl){
    let totalIn=0, totalOut=0, totalUsed=0, totalBalance=0;
    siswaList.forEach(s=>{
      totalIn      += getDepositTopups(s.id);
      totalOut     += getDepositRefunds(s.id);
      totalUsed    += getDepositUsed(s.id);
      totalBalance += getDepositBalance(s.id);
    });
    const studentsWithBalance = siswaList.filter(s=>getDepositBalance(s.id)>0).length;
    statsEl.innerHTML = `
      <div class="stat-card s-green"><div class="ico">💰</div>
        <div class="val" style="font-size:${totalBalance>9999999?'1rem':'1.3rem'}">${fmt(totalBalance)}</div>
        <div class="lbl">Total Deposit Balance</div></div>
      <div class="stat-card s-blue"><div class="ico">👥</div>
        <div class="val">${studentsWithBalance}<span style="font-size:1rem;color:var(--muted)">/${siswaList.length}</span></div>
        <div class="lbl">Students w/ Balance</div></div>
      <div class="stat-card s-yellow"><div class="ico">📥</div>
        <div class="val" style="font-size:${totalIn>9999999?'1rem':'1.3rem'}">${fmt(totalIn)}</div>
        <div class="lbl">Total Top-Ups</div></div>
      <div class="stat-card s-red"><div class="ico">📤</div>
        <div class="val" style="font-size:${(totalUsed+totalOut)>9999999?'1rem':'1.3rem'}">${fmt(totalUsed+totalOut)}</div>
        <div class="lbl">Used + Refunded</div></div>
    `;
  }

  const tbody = document.getElementById('tbody-deposits');
  const empty = document.getElementById('empty-deposits');
  if(!tbody) return;
  tbody.innerHTML = '';

  const filter = (document.getElementById('dep-f-nama')?.value||'').trim().toLowerCase();
  const showZero = document.getElementById('dep-f-showzero')?.checked;

  // Build row per siswa
  const rows = siswaList
    .filter(s=>!filter || s.nama.toLowerCase().includes(filter) || (s.nick||'').toLowerCase().includes(filter))
    .map(s=>{
      const topups  = getDepositTopups(s.id);
      const refunds = getDepositRefunds(s.id);
      const used    = getDepositUsed(s.id);
      const balance = topups - refunds - used;
      return { s, topups, refunds, used, balance };
    })
    .filter(r => showZero || r.balance>0 || r.topups>0)  // hide siswa yg belum pernah deposit
    .sort((a,b)=> b.balance - a.balance);

  if(!rows.length){
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  rows.forEach(({s, topups, refunds, used, balance})=>{
    const balColor = balance>0 ? 'var(--green)' : (balance<0 ? 'var(--red)' : 'var(--muted)');
    tbody.innerHTML += `<tr>
      <td><strong>${s.nama}</strong>${s.nick?` <span style="color:var(--muted);font-size:0.78rem">(${s.nick})</span>`:''}</td>
      <td class="r" style="color:var(--muted);font-size:0.85rem;white-space:nowrap">${fmt(topups)}</td>
      <td class="r" style="color:var(--muted);font-size:0.85rem;white-space:nowrap">${fmt(used)}</td>
      <td class="r" style="color:var(--muted);font-size:0.85rem;white-space:nowrap">${refunds>0?fmt(refunds):'-'}</td>
      <td class="r" style="font-weight:800;color:${balColor};font-size:0.95rem;white-space:nowrap">${fmt(balance)}</td>
      <td class="nowrap">
        <button class="btn sm primary" onclick="openDepositForm(null,'${s.id}')" title="Top Up">➕</button>
        <button class="btn sm" onclick="openDepositDetail('${s.id}')" title="History">📖</button>
        ${balance>0?`<button class="btn sm" onclick="openRefundForm('${s.id}')" title="Refund" style="background:rgba(255,179,71,0.15);color:var(--yellow)">↩️</button>`:''}
      </td>
    </tr>`;
  });
}

// ─── Top-up form ────────────────────────────────────────────────────
function openDepositForm(id, presetSiswaId){
  const d = id ? depositList.find(x=>x.id===id) : null;
  // Refund entries tidak boleh diedit lewat form top-up (akan meng-override tipe-nya).
  // Untuk mengubah refund: hapus & buat ulang.
  if(d && d.tipe === 'refund'){
    showToast('Refund entries cannot be edited — delete and re-create if needed', 'warn', 4000);
    return;
  }
  document.getElementById('form-deposit-title').textContent = d ? '✏️ Edit Top-Up' : '💰 Top Up Deposit';
  // Reset footer to top-up handler (in case previous refund modal was cancelled)
  const footer = document.getElementById('deposit-form-footer');
  if(footer) footer.innerHTML = `
    <button class="btn secondary" onclick="closeDepositForm()">Cancel</button>
    <button class="btn primary" onclick="saveDeposit()">💾 Save</button>
  `;
  document.getElementById('dep-id').value        = d?.id || '';
  document.getElementById('dep-tanggal').value   = d?.tanggal || new Date().toISOString().slice(0,10);
  document.getElementById('dep-jumlah').value    = d?.jumlah || '';
  document.getElementById('dep-metode').value    = d?.metode || 'Transfer';
  document.getElementById('dep-catatan').value   = d?.catatan || '';

  // Populate siswa dropdown
  const sel = document.getElementById('dep-siswa');
  const selId = d?.siswaId || presetSiswaId || '';
  const opts = siswaList.map(s=>`<option value="${s.id}"${s.id===selId?' selected':''}>${s.nama}</option>`).join('');
  sel.innerHTML = '<option value="">-- Select Student --</option>' + opts;
  // Kunci dropdown saat edit: ubah siswa akan membuat saldo dua siswa jadi rusak
  sel.disabled = !!d;
  sel.style.opacity = d ? '0.65' : '';
  sel.style.cursor  = d ? 'not-allowed' : '';

  formatNumberInput('dep-jumlah');
  updateDepositBalanceHint();
  sel.onchange = updateDepositBalanceHint;

  openModal('modal-deposit');
}
function closeDepositForm(){ closeModal('modal-deposit'); }

function updateDepositBalanceHint(){
  const siswaId = document.getElementById('dep-siswa').value;
  const hint    = document.getElementById('dep-balance-hint');
  if(!siswaId){ hint.innerHTML = ''; return; }
  const editId = document.getElementById('dep-id').value;
  // Untuk edit topup: kurangi nilai lama dari saldo agar hint mencerminkan
  // saldo "seolah entry ini belum ada" — konsisten dengan validasi saat save.
  const bal = getDepositBalance(siswaId);
  const editEntry = editId ? depositList.find(x=>x.id===editId) : null;
  const baseBal = editEntry ? (bal - (editEntry.tipe==='topup' ? editEntry.jumlah : -editEntry.jumlah)) : bal;
  hint.innerHTML = `<div style="font-size:0.82rem;color:var(--muted);margin-top:4px">
    Current balance: <strong style="color:${baseBal>0?'var(--green)':'var(--muted)'}">${fmt(baseBal)}</strong>
  </div>`;
}

function saveDeposit(){
  const siswaId = document.getElementById('dep-siswa').value;
  if(!siswaId){ showToast('Select a student!','warn'); return; }
  const s = siswaList.find(x=>x.id===siswaId);
  const id = document.getElementById('dep-id').value;
  const tanggal = document.getElementById('dep-tanggal').value;
  const jumlah  = getNumberValue('dep-jumlah');
  const metode  = document.getElementById('dep-metode').value;
  const catatan = document.getElementById('dep-catatan').value.trim();

  if(!tanggal){ showToast('Date is required!','warn'); return; }
  if(jumlah <= 0){ showToast('Amount must be greater than zero!','warn'); return; }

  const data = { siswaId, namaSiswa:s?.nama||'-', tanggal, jumlah, tipe:'topup', metode, catatan };

  if(id){
    // Edit — cek saldo hasil edit tidak bikin negative
    const i = depositList.findIndex(d=>d.id===id);
    if(i<0){ showToast('Entry not found','warn'); return; }
    const old = depositList[i];
    // Preserve original tipe defensively — form ini hanya untuk top-up,
    // tapi jangan sampai tanpa sengaja mengubah tipe entry yang sudah ada.
    data.tipe = old.tipe;
    // Simulate new balance: current - old.jumlah + new.jumlah (both topups)
    const newBalance = getDepositBalance(siswaId) - old.jumlah + jumlah;
    if(newBalance < 0){
      showToast(`Cannot reduce: this student has already used ${fmt(getDepositUsed(siswaId))} from deposit`, 'warn', 5000);
      return;
    }
    depositList[i] = {...old, ...data};
  } else {
    depositList.push({ id: uid(), ...data });
  }
  DB.set('deposits', depositList);
  closeDepositForm();
  renderDeposits();
  showToast(id?'✅ Top-up updated!':'✅ Deposit added!','success');
}

function deleteDeposit(id){
  const d = depositList.find(x=>x.id===id);
  if(!d) return;
  const label = d.tipe==='refund' ? 'refund' : 'top-up';
  // Cek: hapus entry ini akan bikin saldo siswa negative?
  const balAfter = d.tipe==='topup'
    ? getDepositBalance(d.siswaId) - d.jumlah
    : getDepositBalance(d.siswaId) + d.jumlah;
  if(d.tipe==='topup' && balAfter < 0){
    // Bangun daftar payment yang menarik dari deposit siswa ini
    const usingPays = bayarList
      .filter(b=>b.siswaId===d.siswaId && (+b.depositUsed||0)>0)
      .sort((a,b)=> (a.tanggal||'').localeCompare(b.tanggal||''));
    const usageHtml = usingPays.length
      ? `<div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:0.82rem;text-align:left;max-height:160px;overflow-y:auto">
          <div style="font-weight:700;margin-bottom:6px;color:var(--muted)">Payments using this student's deposit:</div>
          ${usingPays.map(b=>`<div style="padding:3px 0;border-bottom:1px dashed var(--border)">• ${tglFmt(b.tanggal)} — ${b.periode||'—'} · <strong style="color:var(--yellow)">${fmt(b.depositUsed)}</strong> drawn</div>`).join('')}
        </div>`
      : '';
    warningModal(
      '⚠️ Cannot Delete',
      `Deleting this top-up of <strong>${fmt(d.jumlah)}</strong> would leave <strong>${d.namaSiswa}</strong> with a negative balance of <strong style="color:var(--red)">${fmt(balAfter)}</strong>.<br><br>Reduce or delete payments that used this deposit first.${usageHtml}`,
      ()=>{}, { okText:'OK', cancelText:null }
    );
    return;
  }
  dangerModal(
    `Delete ${label}?`,
    `Are you sure you want to delete this ${label} of <strong>${fmt(d.jumlah)}</strong> for <strong>${d.namaSiswa}</strong>?<br><br>` +
    (d.tipe==='refund'
      ? `The refunded amount will return to their deposit balance.`
      : `New balance will be <strong>${fmt(balAfter)}</strong>.`) +
    `<br><br>This cannot be undone.`,
    ()=>{
      depositList = depositList.filter(x=>x.id!==id);
      DB.set('deposits', depositList);
      renderDeposits();
      if(document.getElementById('modal-deposit-detail')?.classList.contains('open')){
        openDepositDetail(d.siswaId);
      }
      showToast('🗑️ Deleted!','success');
    }
  );
}

// ─── Refund form ────────────────────────────────────────────────────
function openRefundForm(siswaId){
  const s = siswaList.find(x=>x.id===siswaId);
  if(!s) return;
  const balance = getDepositBalance(siswaId);
  if(balance <= 0){
    showToast('No balance to refund','warn');
    return;
  }
  document.getElementById('form-deposit-title').textContent = '↩️ Refund Deposit';
  document.getElementById('dep-id').value      = '';
  document.getElementById('dep-tanggal').value = new Date().toISOString().slice(0,10);
  document.getElementById('dep-jumlah').value  = balance;      // default = full balance
  document.getElementById('dep-metode').value  = 'Transfer';
  document.getElementById('dep-catatan').value = '';

  const sel = document.getElementById('dep-siswa');
  sel.innerHTML = `<option value="${siswaId}" selected>${s.nama}</option>`;
  sel.disabled = true;
  sel.style.opacity = '0.65';
  sel.style.cursor = 'not-allowed';

  formatNumberInput('dep-jumlah');
  document.getElementById('dep-balance-hint').innerHTML = `
    <div style="font-size:0.82rem;color:var(--yellow);margin-top:4px;padding:8px 12px;background:rgba(255,179,71,0.12);border-radius:8px;border:1px solid rgba(255,179,71,0.3)">
      Max refund available: <strong>${fmt(balance)}</strong>
    </div>`;

  // Set save button to refund handler
  const footer = document.getElementById('deposit-form-footer');
  footer.innerHTML = `
    <button class="btn secondary" onclick="closeDepositForm()">Cancel</button>
    <button class="btn primary" style="background:linear-gradient(135deg,#ff9500,#ff6b6b);border:none" onclick="saveRefund('${siswaId}')">↩️ Process Refund</button>
  `;
  openModal('modal-deposit');
}

function saveRefund(siswaId){
  const s = siswaList.find(x=>x.id===siswaId);
  const tanggal = document.getElementById('dep-tanggal').value;
  const jumlah  = getNumberValue('dep-jumlah');
  const metode  = document.getElementById('dep-metode').value;
  const catatan = document.getElementById('dep-catatan').value.trim();
  const balance = getDepositBalance(siswaId);

  if(!tanggal){ showToast('Date is required!','warn'); return; }
  if(jumlah <= 0){ showToast('Amount must be greater than zero!','warn'); return; }
  if(jumlah > balance){
    showToast(`Refund exceeds available balance (${fmt(balance)})`,'warn'); return;
  }

  depositList.push({
    id: uid(), siswaId, namaSiswa: s?.nama||'-',
    tanggal, jumlah, tipe:'refund', metode, catatan
  });
  DB.set('deposits', depositList);
  closeDepositForm();
  // Restore normal footer (edit-topup handler)
  document.getElementById('deposit-form-footer').innerHTML = `
    <button class="btn secondary" onclick="closeDepositForm()">Cancel</button>
    <button class="btn primary" onclick="saveDeposit()">💾 Save</button>
  `;
  renderDeposits();
  if(document.getElementById('modal-deposit-detail')?.classList.contains('open')){
    openDepositDetail(siswaId);
  }
  showToast('✅ Refund recorded!','success');
}

// ─── Detail / mutation history ──────────────────────────────────────
function openDepositDetail(siswaId){
  const s = siswaList.find(x=>x.id===siswaId);
  if(!s) return;

  const topups  = depositList.filter(d=>d.siswaId===siswaId && d.tipe==='topup');
  const refunds = depositList.filter(d=>d.siswaId===siswaId && d.tipe==='refund');
  const usedIn  = bayarList.filter(b=>b.siswaId===siswaId && (+b.depositUsed||0)>0);
  const balance = getDepositBalance(siswaId);

  // Merge & sort by date desc
  const mutations = [
    ...topups.map(d=>({date:d.tanggal, type:'topup',  amount:+d.jumlah, entry:d, ref:d.id})),
    ...refunds.map(d=>({date:d.tanggal, type:'refund', amount:-(+d.jumlah), entry:d, ref:d.id})),
    ...usedIn.map(b=>({date:b.tanggal, type:'used',   amount:-(+b.depositUsed), entry:b, ref:b.id}))
  ].sort((a,b)=> new Date(b.date) - new Date(a.date));

  document.getElementById('dep-detail-title').innerHTML = `📖 ${s.nama} — Deposit History`;
  document.getElementById('dep-detail-balance').innerHTML = `
    <div style="text-align:center;padding:16px;background:linear-gradient(135deg,var(--bg3),var(--bg2));border-radius:12px;margin-bottom:16px">
      <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700">Current Balance</div>
      <div style="font-family:'Fredoka One',sans-serif;font-size:2rem;color:${balance>0?'var(--green)':'var(--muted)'};margin:4px 0">${fmt(balance)}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
        <button class="btn sm primary" onclick="closeModal('modal-deposit-detail');openDepositForm(null,'${siswaId}')">➕ Top Up</button>
        ${balance>0?`<button class="btn sm" onclick="closeModal('modal-deposit-detail');openRefundForm('${siswaId}')" style="background:rgba(255,179,71,0.15);color:var(--yellow)">↩️ Refund</button>`:''}
      </div>
    </div>`;

  const body = document.getElementById('dep-detail-body');
  if(!mutations.length){
    body.innerHTML = `<div class="empty"><div class="ei">📭</div><p>No transactions yet.</p></div>`;
    openModal('modal-deposit-detail');
    return;
  }
  body.innerHTML = mutations.map(m=>{
    const amtColor = m.amount>0 ? 'var(--green)' : 'var(--red)';
    const amtSign  = m.amount>0 ? '+' : '−';
    const amtAbs   = Math.abs(m.amount);
    let icon='', label='', actions='', detail='';
    if(m.type==='topup'){
      icon='📥'; label='Top-Up';
      detail = `${m.entry.metode||''}${m.entry.catatan?' · '+m.entry.catatan:''}`;
      actions = `
        <button class="btn sm icon-only" onclick="closeModal('modal-deposit-detail');openDepositForm('${m.entry.id}')">✏️</button>
        <button class="btn danger sm icon-only" onclick="deleteDeposit('${m.entry.id}')">🗑️</button>`;
    } else if(m.type==='refund'){
      icon='↩️'; label='Refund';
      detail = `${m.entry.metode||''}${m.entry.catatan?' · '+m.entry.catatan:''}`;
      actions = `<button class="btn danger sm icon-only" onclick="deleteDeposit('${m.entry.id}')">🗑️</button>`;
    } else {
      icon='💳'; label='Applied to Payment';
      detail = `${m.entry.periode||'Payment'} · Invoice ${fmt(m.entry.tagihan)}`;
      actions = `<button class="btn sm" onclick="closeModal('modal-deposit-detail');navigate('payment');setTimeout(()=>openPaymentForm('${m.entry.id}'),100)">👁️ View</button>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
        <div style="font-size:1.5rem">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.9rem">${label}</div>
          <div style="font-size:0.78rem;color:var(--muted)">${tglFmt(m.date)}${detail?' · '+detail:''}</div>
        </div>
        <div style="font-family:'Fredoka One',sans-serif;font-weight:800;color:${amtColor};white-space:nowrap">${amtSign}${fmt(amtAbs)}</div>
        <div style="display:flex;gap:4px">${actions}</div>
      </div>`;
  }).join('');
  openModal('modal-deposit-detail');
}

// ─── Payment form integration: auto-suggest panel ───────────────────
/**
 * Dipanggil dari onPaymentStudentChange() dan setelah tagihan berubah.
 * Menampilkan panel deposit dengan auto-fill min(saldo, tagihan).
 */
function refreshDepositPanel(){
  const panel   = document.getElementById('deposit-pay-panel');
  if(!panel) return;
  const siswaId = document.getElementById('b-siswa').value;
  const editId  = document.getElementById('b-id').value || null;

  if(!siswaId){
    panel.style.display = 'none';
    return;
  }
  const balance = getDepositBalance(siswaId, editId);  // exclude self when editing
  if(balance <= 0){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';

  const tagihan = getNumberValue('b-tagihan') || 0;
  const useInput = document.getElementById('b-depositUsed');

  // Saat form baru dibuka (belum ada value): auto-suggest.
  // Saat edit atau user sudah mengetik manual: jangan overwrite.
  const isFresh = !useInput.dataset.touched;
  if(isFresh){
    const suggested = Math.min(balance, tagihan);
    useInput.value = suggested > 0 ? 'Rp ' + suggested.toLocaleString('id-ID') : '';
  }
  updateDepositPayHint();
}

function onDepositUsedInput(){
  const el = document.getElementById('b-depositUsed');
  // format thousand separator
  let v = el.value.replace(/\D/g,'');
  el.value = v ? 'Rp ' + Number(v).toLocaleString('id-ID') : '';
  el.dataset.touched = '1';    // stop auto-fill after user edits
  updateDepositPayHint();
}

function updateDepositPayHint(){
  const siswaId = document.getElementById('b-siswa').value;
  const editId  = document.getElementById('b-id').value || null;
  const bal     = getDepositBalance(siswaId, editId);
  const used    = getNumberValue('b-depositUsed');
  const jumlah  = getNumberValue('b-jumlah');
  const tagihan = getNumberValue('b-tagihan');
  const remain  = bal - used;
  const cash    = Math.max(0, jumlah - used);

  const info = document.getElementById('deposit-pay-info');
  if(!info) return;
  let warn = '';
  if(used > bal)                    warn = `<div style="color:var(--red);font-size:0.78rem;margin-top:4px">⚠️ Exceeds balance by ${fmt(used-bal)}</div>`;
  else if(tagihan>0 && used>tagihan) warn = `<div style="color:var(--yellow);font-size:0.78rem;margin-top:4px">⚠️ Exceeds invoice by ${fmt(used-tagihan)}</div>`;

  info.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--muted);gap:12px;flex-wrap:wrap">
      <span>Available: <strong style="color:var(--green)">${fmt(bal)}</strong></span>
      <span>After: <strong style="color:${remain>=0?'var(--text)':'var(--red)'}">${fmt(remain)}</strong></span>
      <span>Cash needed: <strong style="color:var(--yellow)">${fmt(cash)}</strong></span>
    </div>${warn}`;
}

/**
 * Reset touched flag saat student berubah / form dibuka baru.
 */
function resetDepositPanelState(){
  const el = document.getElementById('b-depositUsed');
  if(el){ el.value=''; delete el.dataset.touched; }
}
