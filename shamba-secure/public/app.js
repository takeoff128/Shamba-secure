const state = { tx: [], debts: [], animals: [], users: [], reminders: [], lots: [], schedule: [], currentAnimalId: null, currentLotId: null, role: null, currency: 'KES' };

const CURRENCY_SYMBOLS = {
  KES: 'KSh', UGX: 'USh', TZS: 'TSh', NGN: '\u20a6', GHS: 'GH\u20b5',
  ZAR: 'R', INR: '\u20b9', PHP: '\u20b1', USD: '$', GBP: '\u00a3', EUR: '\u20ac'
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline shell just won't be available */ });
  });
}

function isOwner(){ return state.role === 'owner'; }
function removeBtn(onclick){ return isOwner() ? `<button class="del" onclick="${onclick}">Remove</button>` : ''; }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtMoney(n){ return (CURRENCY_SYMBOLS[state.currency] || state.currency) + ' ' + Math.round(n).toLocaleString(); }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.style.display='none', 2200);
}
function escapeHtml(str){
  const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML;
}

async function api(path, opts = {}){
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------------- AUTH SCREEN ----------------

let CURRENCIES = {};
async function loadCurrencies(){
  try{
    CURRENCIES = await api('/currencies');
    const opts = Object.entries(CURRENCIES).map(([code, info]) => `<option value="${code}">${code} \u2014 ${info.name}</option>`).join('');
    document.getElementById('regCurrency').innerHTML = opts;
    document.getElementById('regCurrency').value = 'KES';
  }catch(e){ /* auth-optional endpoint; ignore failures pre-login */ }
}
loadCurrencies();

document.querySelectorAll('#authModeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#authModeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    document.getElementById('loginForm').style.display = b.dataset.val==='login' ? 'block':'none';
    document.getElementById('registerForm').style.display = b.dataset.val==='register' ? 'block':'none';
  });
});

document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  if (!phone || !password){ err.textContent = 'Enter your phone and password.'; return; }
  try{
    await api('/login', { method:'POST', body:{ phone, password } });
    await enterApp();
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('regBtn').addEventListener('click', async ()=>{
  const farmName = document.getElementById('regFarmName').value.trim();
  const name = document.getElementById('regName').value.trim();
  const currency = document.getElementById('regCurrency').value;
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const err = document.getElementById('regErr');
  err.textContent = '';
  if (!farmName || !name || !phone || !password){ err.textContent = 'Fill in every field.'; return; }
  try{
    await api('/register', { method:'POST', body:{ farmName, name, phone, password, currency } });
    await enterApp();
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await api('/logout', { method:'POST' });
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
});

async function enterApp(){
  const me = await api('/me');
  state.role = me.role;
  state.currency = me.currency || 'KES';
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  document.getElementById('farmNameLabel').textContent = me.farmName;
  document.getElementById('userLabel').textContent = me.name + ' \u00b7 ' + (me.role === 'owner' ? 'Owner' : 'Worker');
  document.getElementById('addWorkerCard').style.display = me.role === 'owner' ? 'block' : 'none';
  document.getElementById('farmSettingsCard').style.display = me.role === 'owner' ? 'block' : 'none';
  if (Object.keys(CURRENCIES).length === 0) await loadCurrencies();
  const farmCurrencySelect = document.getElementById('farmCurrency');
  farmCurrencySelect.innerHTML = document.getElementById('regCurrency').innerHTML;
  farmCurrencySelect.value = state.currency;
  await loadAll();
}

document.getElementById('saveFarmSettingsBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('farmSettingsErr'); err.textContent = '';
  const currency = document.getElementById('farmCurrency').value;
  try{
    await api('/farm', { method:'PATCH', body:{ currency } });
    state.currency = currency;
    showToast('Farm settings saved');
    renderAll();
  }catch(e){ err.textContent = e.message; }
});

(async function initialCheck(){
  try{
    await api('/me');
    await enterApp();
  }catch(e){
    document.getElementById('authScreen').style.display = 'flex';
  }
})();

// ---------------- TABS ----------------
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------------- DATA LOAD ----------------
async function loadAll(){
  const [tx, debts, animals, users, reminders, lots, schedule] = await Promise.all([
    api('/transactions'), api('/debts'), api('/animals'), api('/users'), api('/reminders'),
    api('/broiler-lots'), api('/broiler-schedule')
  ]);
  state.tx = tx; state.debts = debts; state.animals = animals; state.users = users;
  state.reminders = reminders; state.lots = lots; state.schedule = schedule;
  renderAll();
}
function renderAll(){
  renderDash(); renderTx(); renderDebts(); renderAnimals(); renderUsers(); renderReminders();
  renderScheduleRef(); renderLots();
}

// ---------------- TRANSACTIONS ----------------
document.getElementById('txDate').value = todayStr();
let txType = 'income';
document.querySelectorAll('#txTypeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#txTypeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); txType = b.dataset.val;
  });
});
document.getElementById('addTxBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('txErr'); err.textContent = '';
  const amount = parseFloat(document.getElementById('txAmount').value);
  const description = document.getElementById('txDesc').value.trim();
  const category = document.getElementById('txCategory').value;
  const tx_date = document.getElementById('txDate').value || todayStr();
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (!description){ err.textContent = 'Add a short description.'; return; }
  try{
    await api('/transactions', { method:'POST', body:{ type:txType, amount, category, description, tx_date } });
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    showToast('Transaction saved');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});
async function deleteTx(id){
  await api('/transactions/'+id, { method:'DELETE' });
  await loadAll();
}

// ---------------- DEBTS ----------------
let debtDirection = 'owed_to_me';
document.querySelectorAll('#debtTypeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#debtTypeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); debtDirection = b.dataset.val;
    const showPhone = debtDirection === 'owed_to_me';
    document.getElementById('debtPhoneLabel').style.display = showPhone ? 'block' : 'none';
    document.getElementById('debtPhone').style.display = showPhone ? 'block' : 'none';
  });
});
document.getElementById('addDebtBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('debtErr'); err.textContent = '';
  const person = document.getElementById('debtPerson').value.trim();
  const phone = document.getElementById('debtPhone').value.trim();
  const amount = parseFloat(document.getElementById('debtAmount').value);
  const description = document.getElementById('debtDesc').value.trim();
  const due_date = document.getElementById('debtDue').value || null;
  if (!person){ err.textContent = 'Enter a name first.'; return; }
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  try{
    await api('/debts', { method:'POST', body:{
      direction:debtDirection, person,
      phone: debtDirection === 'owed_to_me' ? (phone || null) : null,
      amount, description, due_date
    }});
    document.getElementById('debtPerson').value = '';
    document.getElementById('debtPhone').value = '';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDesc').value = '';
    document.getElementById('debtDue').value = '';
    showToast('Debt saved');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});
async function toggleSettle(id){ await api('/debts/'+id+'/settle', { method:'PATCH' }); await loadAll(); }
async function deleteDebt(id){ await api('/debts/'+id, { method:'DELETE' }); await loadAll(); }

// ---------------- ANIMALS ----------------
document.getElementById('addAnimalBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('anErr'); err.textContent = '';
  const tag_id = document.getElementById('anTag').value.trim();
  const species = document.getElementById('anSpecies').value;
  const breed = document.getElementById('anBreed').value.trim();
  const sex = document.getElementById('anSex').value;
  const dob = document.getElementById('anDob').value || null;
  const acquired_date = document.getElementById('anAcquired').value || null;
  if (!tag_id){ err.textContent = 'Give this animal a tag or name.'; return; }
  try{
    await api('/animals', { method:'POST', body:{ tag_id, species, breed, sex, dob, acquired_date } });
    document.getElementById('anTag').value = '';
    document.getElementById('anBreed').value = '';
    showToast('Animal added');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

function openAnimalModal(id){
  state.currentAnimalId = id;
  const animal = state.animals.find(a=>a.id===id);
  document.getElementById('modalAnimalTitle').textContent = animal.tag_id;
  document.getElementById('modalAnimalMeta').textContent =
    [animal.species, animal.breed, animal.sex, animal.dob ? 'born ' + animal.dob : null].filter(Boolean).join(' \u00b7 ');
  document.getElementById('modalStatus').value = animal.status;
  document.getElementById('evDate').value = todayStr();
  document.getElementById('modalRemDate').value = todayStr();
  document.getElementById('animalModal').style.display = 'flex';
  loadEvents(id);
}
function closeAnimalModal(){
  document.getElementById('animalModal').style.display = 'none';
  state.currentAnimalId = null;
}
document.getElementById('closeModalBtn').addEventListener('click', closeAnimalModal);

document.getElementById('modalStatusBtn').addEventListener('click', async ()=>{
  const status = document.getElementById('modalStatus').value;
  await api('/animals/'+state.currentAnimalId, { method:'PATCH', body:{ status } });
  showToast('Status updated');
  await loadAll();
});

document.getElementById('modalRemBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('modalRemErr'); err.textContent = '';
  const remind_date = document.getElementById('modalRemDate').value;
  const message = document.getElementById('modalRemMessage').value.trim();
  if (!remind_date){ err.textContent = 'Pick a date.'; return; }
  if (!message){ err.textContent = 'Enter a message.'; return; }
  const animal = state.animals.find(a=>a.id===state.currentAnimalId);
  try{
    await api('/reminders', { method:'POST', body:{
      remind_date, subject_type:'animal', subject_id: state.currentAnimalId,
      message: `${animal.tag_id}: ${message}`
    }});
    document.getElementById('modalRemMessage').value = '';
    showToast('Reminder saved');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

async function loadEvents(animalId){
  const events = await api('/animals/'+animalId+'/events');
  const el = document.getElementById('eventList');
  if (events.length === 0){ el.innerHTML = '<div class="empty">No records yet.</div>'; return; }
  el.innerHTML = events.map(ev => `
    <div class="item">
      <div><div class="name">${labelForEvent(ev.event_type)}</div>
        <div class="meta">${ev.event_date} ${ev.detail ? '&middot; ' + escapeHtml(ev.detail) : ''}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${ev.value != null ? '<div class="amt">' + ev.value + '</div>' : ''}
        ${removeBtn(`deleteEvent(${ev.id})`)}
      </div>
    </div>`).join('');
}
function labelForEvent(t){
  return { health:'Health / vet', breeding:'Breeding', production:'Production', weight:'Weight', other:'Other' }[t] || t;
}

document.getElementById('addEventBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('evErr'); err.textContent = '';
  const event_type = document.getElementById('evType').value;
  const event_date = document.getElementById('evDate').value || todayStr();
  const detail = document.getElementById('evDetail').value.trim();
  const valueRaw = document.getElementById('evValue').value;
  const value = valueRaw ? parseFloat(valueRaw) : null;
  try{
    await api('/animals/'+state.currentAnimalId+'/events', { method:'POST', body:{ event_type, event_date, detail, value } });
    document.getElementById('evDetail').value = '';
    document.getElementById('evValue').value = '';
    showToast('Record saved');
    loadEvents(state.currentAnimalId);
  }catch(e){ err.textContent = e.message; }
});

async function deleteEvent(id){
  await api('/events/'+id, { method:'DELETE' });
  loadEvents(state.currentAnimalId);
}

async function deleteAnimal(id, evt){
  evt.stopPropagation();
  if (!confirm('Remove this animal and all its records?')) return;
  await api('/animals/'+id, { method:'DELETE' });
  await loadAll();
}

// ---------------- BROILER LOTS ----------------
document.getElementById('lotStartDate').value = todayStr();

document.getElementById('addLotBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('lotErr'); err.textContent = '';
  const name = document.getElementById('lotName').value.trim();
  const quantity = document.getElementById('lotQuantity').value;
  const start_date = document.getElementById('lotStartDate').value || todayStr();
  if (!name){ err.textContent = 'Give this lot a name or tag.'; return; }
  try{
    await api('/broiler-lots', { method:'POST', body:{ name, quantity: quantity || null, start_date } });
    document.getElementById('lotName').value = '';
    document.getElementById('lotQuantity').value = '';
    showToast('Lot started \u2014 28-day schedule created');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

function daysBetween(a, b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }

function renderScheduleRef(){
  const el = document.getElementById('scheduleRef');
  el.innerHTML = state.schedule.map(s=>`
    <div class="item">
      <div><div class="name">Day ${s.day}: ${escapeHtml(s.title)}</div><div class="meta">${escapeHtml(s.detail)}</div></div>
    </div>`).join('');
}

function renderLots(){
  const el = document.getElementById('lotList');
  if (state.lots.length===0){ el.innerHTML = '<div class="empty">No lots started yet.</div>'; return; }
  el.innerHTML = state.lots.map(lot=>{
    const dayNum = daysBetween(lot.start_date, todayStr());
    const next = state.schedule.find(s => s.day > dayNum);
    const dayLabel = dayNum < 0 ? 'Not started yet' : `Day ${dayNum} of ${lot.cycle_days}`;
    return `
    <div class="animal-card" onclick="openLotModal(${lot.id})">
      <div class="top">
        <h3>${escapeHtml(lot.name)}</h3>
        <span class="pill ${lot.status==='active' ? 'active' : 'settled'}">${lot.status}</span>
      </div>
      <div class="meta">${lot.quantity ? lot.quantity + ' birds \u00b7 ' : ''}started ${lot.start_date} \u00b7 ${dayLabel}</div>
      ${next && lot.status==='active' ? `<div class="meta" style="margin-top:4px;color:var(--gold-600);font-weight:600;">Next: Day ${next.day} \u2014 ${escapeHtml(next.title)}</div>` : ''}
      <div style="text-align:right;margin-top:6px;">
        ${removeBtn(`deleteLot(${lot.id}, event)`)}
      </div>
    </div>`;
  }).join('');
}

async function deleteLot(id, evt){
  evt.stopPropagation();
  if (!confirm('Remove this lot and its scheduled reminders?')) return;
  await api('/broiler-lots/'+id, { method:'DELETE' });
  await loadAll();
}

function openLotModal(id){
  state.currentLotId = id;
  const lot = state.lots.find(l=>l.id===id);
  document.getElementById('modalLotTitle').textContent = lot.name;
  document.getElementById('modalLotMeta').textContent =
    [lot.quantity ? lot.quantity + ' birds' : null, 'started ' + lot.start_date].filter(Boolean).join(' \u00b7 ');
  document.getElementById('modalLotStatus').value = lot.status;
  document.getElementById('lotRemDate').value = todayStr();
  document.getElementById('lotModal').style.display = 'flex';
  loadLotReminders(id);
}
function closeLotModal(){
  document.getElementById('lotModal').style.display = 'none';
  state.currentLotId = null;
}
document.getElementById('closeLotModalBtn').addEventListener('click', closeLotModal);

document.getElementById('modalLotStatusBtn').addEventListener('click', async ()=>{
  const status = document.getElementById('modalLotStatus').value;
  await api('/broiler-lots/'+state.currentLotId, { method:'PATCH', body:{ status } });
  showToast('Status updated');
  await loadAll();
});

async function loadLotReminders(lotId){
  const rows = await api('/broiler-lots/'+lotId+'/reminders');
  const el = document.getElementById('lotReminderList');
  if (rows.length===0){ el.innerHTML = '<div class="empty">No reminders yet.</div>'; return; }
  el.innerHTML = rows.map(r=>`
    <div class="item">
      <div><div class="name">${escapeHtml(r.message)}</div><div class="meta">${r.remind_date}</div></div>
      <span class="pill ${r.sent_at ? 'settled' : 'owe-me'}">${r.sent_at ? 'Sent' : 'Pending'}</span>
    </div>`).join('');
}

document.getElementById('lotRemBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('lotRemErr'); err.textContent = '';
  const remind_date = document.getElementById('lotRemDate').value;
  const message = document.getElementById('lotRemMessage').value.trim();
  if (!remind_date){ err.textContent = 'Pick a date.'; return; }
  if (!message){ err.textContent = 'Enter a message.'; return; }
  const lot = state.lots.find(l=>l.id===state.currentLotId);
  try{
    await api('/reminders', { method:'POST', body:{
      remind_date, subject_type:'broiler_lot', subject_id: state.currentLotId,
      message: `${lot.name}: ${message}`
    }});
    document.getElementById('lotRemMessage').value = '';
    showToast('Reminder saved');
    loadLotReminders(state.currentLotId);
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

// ---------------- REMINDERS ----------------
document.getElementById('remDate').value = todayStr();

document.getElementById('addReminderBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('remErr'); err.textContent = '';
  const remind_date = document.getElementById('remDate').value;
  const message = document.getElementById('remMessage').value.trim();
  if (!remind_date){ err.textContent = 'Pick a date.'; return; }
  if (!message){ err.textContent = 'Enter a message.'; return; }
  try{
    await api('/reminders', { method:'POST', body:{ remind_date, message, subject_type:'custom' } });
    document.getElementById('remMessage').value = '';
    showToast('Reminder saved');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('runNowBtn').addEventListener('click', async ()=>{
  try{
    const res = await api('/reminders/run-now', { method:'POST' });
    showToast(res.sent > 0 ? `Sent ${res.sent} reminder(s)` : 'Nothing due today');
    await loadAll();
  }catch(e){ showToast(e.message); }
});

async function deleteReminder(id){
  await api('/reminders/'+id, { method:'DELETE' });
  await loadAll();
}

function renderReminders(){
  const el = document.getElementById('reminderList');
  if (state.reminders.length===0){ el.innerHTML = '<div class="empty">No reminders yet.</div>'; return; }
  el.innerHTML = state.reminders.map(r=>`
    <div class="item">
      <div><div class="name">${escapeHtml(r.message)}</div>
        <div class="meta">${r.remind_date} &middot; ${labelForSubject(r.subject_type)}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="pill ${r.sent_at ? 'settled' : 'owe-me'}">${r.sent_at ? 'Sent' : 'Pending'}</span>
        ${removeBtn(`deleteReminder(${r.id})`)}
      </div>
    </div>`).join('');
}
function labelForSubject(t){
  return { debt:'Debt', animal:'Livestock', custom:'General' }[t] || t;
}

// ---------------- TEAM ----------------
document.getElementById('addWorkerBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('wErr'); err.textContent = '';
  const name = document.getElementById('wName').value.trim();
  const phone = document.getElementById('wPhone').value.trim();
  const password = document.getElementById('wPassword').value;
  if (!name || !phone || !password){ err.textContent = 'Fill in every field.'; return; }
  try{
    await api('/users', { method:'POST', body:{ name, phone, password } });
    document.getElementById('wName').value = '';
    document.getElementById('wPhone').value = '';
    document.getElementById('wPassword').value = '';
    showToast('Added to the farm');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

// ---------------- RENDER ----------------
function renderDash(){
  const income = state.tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = state.tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net = income - expense;
  document.getElementById('dashStats').innerHTML = `
    <div class="stat ${net>=0?'pos':'neg'}"><div class="label">Net balance</div><div class="value">${fmtMoney(net)}</div></div>
    <div class="stat pos"><div class="label">Total in</div><div class="value">${fmtMoney(income)}</div></div>
    <div class="stat neg"><div class="label">Total out</div><div class="value">${fmtMoney(expense)}</div></div>
  `;
  const owedToMe = state.debts.filter(d=>d.direction==='owed_to_me' && !d.settled).reduce((s,d)=>s+d.amount,0);
  const iOwe = state.debts.filter(d=>d.direction==='i_owe' && !d.settled).reduce((s,d)=>s+d.amount,0);
  document.getElementById('dashOwedToMe').textContent = fmtMoney(owedToMe);
  document.getElementById('dashIOwe').textContent = fmtMoney(iOwe);

  const active = state.animals.filter(a=>a.status==='active').length;
  const sold = state.animals.filter(a=>a.status==='sold').length;
  const deceased = state.animals.filter(a=>a.status==='deceased').length;
  document.getElementById('dashHerd').innerHTML = `
    <div class="stat"><div class="label">Active</div><div class="value">${active}</div></div>
    <div class="stat"><div class="label">Sold</div><div class="value">${sold}</div></div>
    <div class="stat"><div class="label">Deceased</div><div class="value">${deceased}</div></div>
  `;
}

function renderTx(){
  const el = document.getElementById('txList');
  if (state.tx.length===0){ el.innerHTML = '<div class="empty">No transactions yet.</div>'; return; }
  el.innerHTML = state.tx.slice(0,30).map(t=>`
    <div class="item">
      <div><div class="name">${escapeHtml(t.description)}</div><div class="meta">${escapeHtml(t.category)} &middot; ${t.tx_date}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="amt ${t.type==='income'?'plus':'minus'}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount)}</div>
        ${removeBtn(`deleteTx(${t.id})`)}
      </div>
    </div>`).join('');
}

function renderDebts(){
  const el = document.getElementById('debtList');
  if (state.debts.length===0){ el.innerHTML = '<div class="empty">No debts recorded.</div>'; return; }
  el.innerHTML = state.debts.map(d=>`
    <div class="item">
      <div><div class="name">${escapeHtml(d.person)}${d.phone ? ' <span class="meta">(' + escapeHtml(d.phone) + ')</span>' : ''}</div>
        <div class="meta">${escapeHtml(d.description||'')} ${d.due_date ? '&middot; due '+d.due_date : ''}</div></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="pill ${d.settled ? 'settled' : (d.direction==='owed_to_me'?'owe-me':'i-owe')}">${d.settled ? 'Settled' : (d.direction==='owed_to_me' ? 'Owes you' : 'You owe')}</span>
        <div class="amt">${fmtMoney(d.amount)}</div>
      </div>
    </div>
    <div style="display:flex;gap:14px;justify-content:flex-end;margin:-6px 0 8px;">
      <button class="del" style="color:var(--leaf-700)" onclick="toggleSettle(${d.id})">${d.settled?'Mark unsettled':'Mark settled'}</button>
      ${removeBtn(`deleteDebt(${d.id})`)}
    </div>
  `).join('');
}

function renderAnimals(){
  const el = document.getElementById('animalList');
  if (state.animals.length===0){ el.innerHTML = '<div class="empty">No animals added yet.</div>'; return; }
  el.innerHTML = state.animals.map(a=>`
    <div class="animal-card" onclick="openAnimalModal(${a.id})">
      <div class="top">
        <h3>${escapeHtml(a.tag_id)}</h3>
        <span class="pill ${a.status}">${a.status}</span>
      </div>
      <div class="meta">${[a.species, a.breed, a.sex].filter(Boolean).join(' \u00b7 ')}</div>
      <div style="text-align:right;margin-top:6px;">
        ${removeBtn(`deleteAnimal(${a.id}, event)`)}
      </div>
    </div>`).join('');
}

function renderUsers(){
  const el = document.getElementById('userList');
  if (state.users.length===0){ el.innerHTML = '<div class="empty">No one added yet.</div>'; return; }
  el.innerHTML = state.users.map(u=>`
    <div class="item">
      <div><div class="name">${escapeHtml(u.name)}</div><div class="meta">${escapeHtml(u.phone)}</div></div>
      <span class="pill ${u.role==='owner' ? 'owe-me' : 'settled'}">${u.role}</span>
    </div>`).join('');
}
