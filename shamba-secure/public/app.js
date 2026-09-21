const state = { tx: [], debts: [], animals: [], users: [], reminders: [], lots: [], schedule: [], currentAnimalId: null, currentLotId: null, role: null, currency: 'KES' };

const CURRENCY_SYMBOLS = {
  KES: 'KSh', UGX: 'USh', TZS: 'TSh', NGN: '\u20a6', GHS: 'GH\u20b5',
  ZAR: 'R', INR: '\u20b9', PHP: '\u20b1', USD: '$', GBP: '\u00a3', EUR: '\u20ac'
};

const POULTRY_SCHEDULES = {
  broiler: [
    { day: 0, title: 'Lot started', detail: 'Set up the brooder at 32-35\u00b0C, start on chick/starter feed, and ensure clean water is always available.' },
    { day: 7, title: 'First vaccination', detail: 'Vaccinate against Newcastle/Gumboro disease as per your vet\u2019s program. Watch for any birds off their feed.' },
    { day: 14, title: 'Mid-cycle check', detail: 'Weigh a sample of birds, check for a booster dose due around now, and watch mortality and feed intake closely.' },
    { day: 21, title: 'Switch to finisher feed & booster', detail: 'Move the flock onto finisher feed and give the booster vaccination dose.' },
    { day: 28, title: 'End of cycle \u2014 ready for market', detail: 'Birds should be near market weight. Plan sales or slaughter and start preparing the next lot.' }
  ],
  layer: [
    { day: 0, title: 'Chicks arrive', detail: 'Brooder at 32-35\u00b0C, chick mash, clean water always available. Marek\u2019s vaccine is often already given at the hatchery on day 1.' },
    { day: 9, title: 'Newcastle & Gumboro (1st dose)', detail: 'Vaccinate against Newcastle Disease and Infectious Bursal Disease (Gumboro) as per your vet\u2019s program.' },
    { day: 14, title: 'Gumboro booster', detail: 'Second Gumboro dose. Watch feed intake and droppings closely this week.' },
    { day: 28, title: 'Fowl typhoid vaccine', detail: 'Vaccinate against fowl typhoid. Deworm if this hasn\u2019t been done yet.' },
    { day: 42, title: 'Switch to grower mash', detail: 'Move off chick mash onto grower mash as the pullets mature.' },
    { day: 56, title: 'Fowl pox vaccine', detail: 'Wing-web vaccination against fowl pox.' },
    { day: 70, title: 'Newcastle booster', detail: 'Booster dose to maintain immunity through lay.' },
    { day: 98, title: 'Deworm', detail: 'Routine deworming ahead of the switch to layer feed.' },
    { day: 126, title: 'Switch to layer mash', detail: 'Move onto layer mash with higher calcium as point of lay approaches.' },
    { day: 140, title: 'Point of lay \u2014 expect first eggs', detail: 'Most breeds begin laying around now. Start daily egg collection and recording \u2014 laying continues for many months from here.' }
  ]
};
function scheduleFor(type){ return POULTRY_SCHEDULES[type] || POULTRY_SCHEDULES.broiler; }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline shell just won't be available */ });
  });
}

function isOwner(){ return state.role === 'owner'; }
function removeBtn(onclick){ return isOwner() ? `<button class="del" onclick="${onclick}">Remove</button>` : ''; }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtMoney(n){ return (CURRENCY_SYMBOLS[state.currency] || state.currency) + ' ' + Math.round(n).toLocaleString(); }
function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.style.display='none', 2200);
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
    document.getElementById('forgotForm').style.display = 'none';
  });
});

document.getElementById('showForgotBtn').addEventListener('click', ()=>{
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'block';
});
document.getElementById('backToLoginBtn').addEventListener('click', ()=>{
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('forgotErr').textContent = '';
  document.getElementById('forgotSuccess').textContent = '';
});

document.getElementById('forgotBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('forgotErr'); err.textContent = '';
  const success = document.getElementById('forgotSuccess'); success.textContent = '';
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email){ err.textContent = 'Enter your email address.'; return; }
  try{
    const res = await api('/forgot-password', { method:'POST', body:{ email } });
    success.textContent = res.message;
    document.getElementById('forgotEmail').value = '';
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const identifier = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  if (!identifier || !password){ err.textContent = 'Enter your phone or email, and your password.'; return; }
  try{
    await api('/login', { method:'POST', body:{ identifier, password } });
    await enterApp();
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('regBtn').addEventListener('click', async ()=>{
  const farmName = document.getElementById('regFarmName').value.trim();
  const name = document.getElementById('regName').value.trim();
  const currency = document.getElementById('regCurrency').value;
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const err = document.getElementById('regErr');
  err.textContent = '';
  if (!farmName || !name || !phone || !email || !password){ err.textContent = 'Fill in every field.'; return; }
  try{
    await api('/register', { method:'POST', body:{ farmName, name, phone, email, password, currency } });
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
  document.getElementById('clearTxBtn').style.display = me.role === 'owner' ? 'inline-block' : 'none';
  document.getElementById('clearDebtsBtn').style.display = me.role === 'owner' ? 'inline-block' : 'none';

  const banner = document.getElementById('verifyBanner');
  if (!me.emailVerified && me.email){
    banner.style.display = 'block';
    document.getElementById('verifyEmailLabel').textContent = me.email;
  } else {
    banner.style.display = 'none';
  }

  const phoneBanner = document.getElementById('verifyPhoneBanner');
  if (!me.phoneVerified && me.phone){
    phoneBanner.style.display = 'block';
    document.getElementById('verifyPhoneLabel').textContent = me.phone;
  } else {
    phoneBanner.style.display = 'none';
  }

  if (Object.keys(CURRENCIES).length === 0) await loadCurrencies();
  const farmCurrencySelect = document.getElementById('farmCurrency');
  farmCurrencySelect.innerHTML = document.getElementById('regCurrency').innerHTML;
  farmCurrencySelect.value = state.currency;
  await loadAll();
  refreshPushButton();
}

document.getElementById('verifyCodeBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('verifyErr'); err.textContent = '';
  const success = document.getElementById('verifySuccess'); success.textContent = '';
  const code = document.getElementById('verifyCodeInput').value.trim();
  if (!code){ err.textContent = 'Enter the code from your email.'; return; }
  try{
    await api('/verify-email', { method:'POST', body:{ code } });
    document.getElementById('verifyBanner').style.display = 'none';
    showToast('Email verified');
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('resendCodeBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('verifyErr'); err.textContent = '';
  const success = document.getElementById('verifySuccess'); success.textContent = '';
  try{
    await api('/resend-verification', { method:'POST' });
    success.textContent = 'A new code has been sent.';
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('verifyPhoneCodeBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('verifyPhoneErr'); err.textContent = '';
  const success = document.getElementById('verifyPhoneSuccess'); success.textContent = '';
  const code = document.getElementById('verifyPhoneCodeInput').value.trim();
  if (!code){ err.textContent = 'Enter the code from your text message.'; return; }
  try{
    await api('/verify-phone', { method:'POST', body:{ code } });
    document.getElementById('verifyPhoneBanner').style.display = 'none';
    showToast('Phone number verified');
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('resendPhoneCodeBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('verifyPhoneErr'); err.textContent = '';
  const success = document.getElementById('verifyPhoneSuccess'); success.textContent = '';
  try{
    await api('/resend-phone-verification', { method:'POST' });
    success.textContent = 'A new code has been sent.';
  }catch(e){ err.textContent = e.message; }
});

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
  const [tx, debts, animals, users, reminders, lots] = await Promise.all([
    api('/transactions'), api('/debts'), api('/animals'), api('/users'), api('/reminders'),
    api('/broiler-lots')
  ]);
  state.tx = tx; state.debts = debts; state.animals = animals; state.users = users;
  state.reminders = reminders; state.lots = lots;
  renderAll();
}
function renderAll(){
  renderDash(); renderTx(); renderDebts(); renderAnimals(); renderUsers(); renderReminders();
  renderScheduleRef(); renderLots(); renderAnimalSalesSummary();
  renderTxHistory(); renderDebtHistory();
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
document.getElementById('txLivestockType').addEventListener('change', ()=>{
  const show = document.getElementById('txLivestockType').value !== '';
  document.getElementById('txQuantityLabel').style.display = show ? 'block' : 'none';
  document.getElementById('txQuantity').style.display = show ? 'block' : 'none';
  if (!show) document.getElementById('txQuantity').value = '';
});
document.getElementById('addTxBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('txErr'); err.textContent = '';
  const amount = parseFloat(document.getElementById('txAmount').value);
  const description = document.getElementById('txDesc').value.trim();
  const category = document.getElementById('txCategory').value;
  const tx_date = document.getElementById('txDate').value || todayStr();
  const livestock_type = document.getElementById('txLivestockType').value || null;
  const quantityRaw = document.getElementById('txQuantity').value;
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (!description){ err.textContent = 'Add a short description.'; return; }
  if (livestock_type && (!quantityRaw || parseInt(quantityRaw, 10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
  try{
    await api('/transactions', { method:'POST', body:{
      type:txType, amount, category, description, tx_date,
      livestock_type, quantity: livestock_type ? quantityRaw : null
    }});
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    document.getElementById('txLivestockType').value = '';
    document.getElementById('txQuantity').value = '';
    document.getElementById('txQuantityLabel').style.display = 'none';
    document.getElementById('txQuantity').style.display = 'none';
    showToast('Transaction saved');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});
async function deleteTx(id){
  if (!confirm('Delete this transaction? This can\'t be undone.')) return;
  await api('/transactions/'+id, { method:'DELETE' });
  await loadAll();
}

document.getElementById('clearTxBtn').addEventListener('click', async ()=>{
  const count = state.tx.length;
  if (count === 0){ showToast('No transactions to clear'); return; }
  const confirmed = confirm(
    `Delete all ${count} transaction${count === 1 ? '' : 's'} for this farm? ` +
    `This can't be undone. Any debt marked settled by one of these transactions will revert to unsettled.`
  );
  if (!confirmed) return;
  try{
    const res = await api('/transactions', { method:'DELETE' });
    showToast(`Cleared ${res.deleted} transaction${res.deleted === 1 ? '' : 's'}`);
    await loadAll();
  }catch(e){ showToast(e.message); }
});

document.getElementById('clearDebtsBtn').addEventListener('click', async ()=>{
  const count = state.debts.length;
  if (count === 0){ showToast('No debts to clear'); return; }
  const confirmed = confirm(
    `Delete all ${count} debt${count === 1 ? '' : 's'} for this farm? ` +
    `This can't be undone. Any transactions already created by settling these debts will NOT be removed \u2014 only the debt entries themselves.`
  );
  if (!confirmed) return;
  try{
    const res = await api('/debts', { method:'DELETE' });
    showToast(`Cleared ${res.deleted} debt${res.deleted === 1 ? '' : 's'}`);
    await loadAll();
  }catch(e){ showToast(e.message); }
});

function renderAnimalSalesSummary(){
  const el = document.getElementById('animalSalesSummary');
  const types = ['chicken', 'goat', 'cow'];
  const labels = { chicken: 'Chicken', goat: 'Goats', cow: 'Cows' };
  el.innerHTML = types.map(t=>{
    // Direct cash sales — excluding the auto-created "Debt settlement"
    // transactions, since those are counted from the debt itself below
    // (a sale counts the moment it happens, not only once it's paid).
    const cashSales = state.tx.filter(tx => tx.type === 'income' && tx.category !== 'Debt settlement' && tx.livestock_type === t);
    // Sales made on credit — counted as soon as the debt is recorded,
    // whether or not it's been paid yet.
    const creditSales = state.debts.filter(d => d.direction === 'owed_to_me' && d.livestock_type === t);

    const pieces = cashSales.reduce((s, tx) => s + (tx.quantity || 0), 0)
      + creditSales.reduce((s, d) => s + (d.quantity || 0), 0);
    const total = cashSales.reduce((s, tx) => s + tx.amount, 0)
      + creditSales.reduce((s, d) => s + d.amount, 0);

    return `
      <div class="stat">
        <div class="label">${labels[t]}</div>
        <div class="value">${pieces} sold</div>
        <div class="meta" style="margin-top:2px;">${fmtMoney(total)}</div>
      </div>`;
  }).join('');
}

// ---------------- DEBTS ----------------
// Contact Picker API — only Chrome for Android supports this today.
// It's privacy-friendly by design: the browser shows its own native picker
// and the person chooses one contact to share, once, per tap — no ongoing
// "contacts access" permission is granted to the app.
if ('contacts' in navigator && 'ContactsManager' in window) {
  document.getElementById('pickContactBtn').style.display = 'inline-block';
}
document.getElementById('pickContactBtn').addEventListener('click', async ()=>{
  try{
    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    if (!contacts || contacts.length === 0) return; // person cancelled the picker
    const contact = contacts[0];
    if (contact.tel && contact.tel.length > 0){
      document.getElementById('debtPhone').value = contact.tel[0];
    }
    if (contact.name && contact.name.length > 0 && !document.getElementById('debtPerson').value.trim()){
      document.getElementById('debtPerson').value = contact.name[0];
    }
  }catch(e){
    showToast('Could not open contacts.');
  }
});

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
document.getElementById('debtLivestockType').addEventListener('change', ()=>{
  const show = document.getElementById('debtLivestockType').value !== '';
  document.getElementById('debtQuantityLabel').style.display = show ? 'block' : 'none';
  document.getElementById('debtQuantity').style.display = show ? 'block' : 'none';
  if (!show) document.getElementById('debtQuantity').value = '';
});
document.getElementById('addDebtBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('debtErr'); err.textContent = '';
  const person = document.getElementById('debtPerson').value.trim();
  const phone = document.getElementById('debtPhone').value.trim();
  const amount = parseFloat(document.getElementById('debtAmount').value);
  const description = document.getElementById('debtDesc').value.trim();
  const due_date = document.getElementById('debtDue').value || null;
  const livestock_type = document.getElementById('debtLivestockType').value || null;
  const quantityRaw = document.getElementById('debtQuantity').value;
  if (!person){ err.textContent = 'Enter a name first.'; return; }
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (livestock_type && (!quantityRaw || parseInt(quantityRaw, 10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
  try{
    await api('/debts', { method:'POST', body:{
      direction:debtDirection, person,
      phone: debtDirection === 'owed_to_me' ? (phone || null) : null,
      amount, description, due_date,
      livestock_type, quantity: livestock_type ? quantityRaw : null
    }});
    document.getElementById('debtPerson').value = '';
    document.getElementById('debtPhone').value = '';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDesc').value = '';
    document.getElementById('debtDue').value = '';
    document.getElementById('debtLivestockType').value = '';
    document.getElementById('debtQuantity').value = '';
    document.getElementById('debtQuantityLabel').style.display = 'none';
    document.getElementById('debtQuantity').style.display = 'none';
    showToast('Debt saved');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});
async function toggleSettle(id){ await api('/debts/'+id+'/settle', { method:'PATCH' }); await loadAll(); }
async function deleteDebt(id){
  if (!confirm('Delete this debt record? This can\'t be undone.')) return;
  await api('/debts/'+id, { method:'DELETE' });
  await loadAll();
}

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
  if (!confirm('Delete this record? This can\'t be undone.')) return;
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
document.getElementById('lotPoultryType').addEventListener('change', renderScheduleRef);
renderScheduleRef();

document.getElementById('addLotBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('lotErr'); err.textContent = '';
  const name = document.getElementById('lotName').value.trim();
  const poultry_type = document.getElementById('lotPoultryType').value;
  const quantity = document.getElementById('lotQuantity').value;
  const start_date = document.getElementById('lotStartDate').value || todayStr();
  if (!name){ err.textContent = 'Give this lot a name or tag.'; return; }
  try{
    await api('/broiler-lots', { method:'POST', body:{ name, poultry_type, quantity: quantity || null, start_date } });
    document.getElementById('lotName').value = '';
    document.getElementById('lotQuantity').value = '';
    showToast(`Lot started \u2014 ${poultry_type === 'layer' ? 'layer' : 'broiler'} schedule created`);
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

function daysBetween(a, b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }

function renderScheduleRef(){
  const type = document.getElementById('lotPoultryType').value;
  const el = document.getElementById('scheduleRef');
  el.innerHTML = scheduleFor(type).map(s=>`
    <div class="item">
      <div><div class="name">Day ${s.day}: ${escapeHtml(s.title)}</div><div class="meta">${escapeHtml(s.detail)}</div></div>
    </div>`).join('');
}

function totalLost(lot){ return lot.total_lost || 0; }

function renderLots(){
  const el = document.getElementById('lotList');
  if (state.lots.length===0){ el.innerHTML = '<div class="empty">No lots started yet.</div>'; return; }
  el.innerHTML = state.lots.map(lot=>{
    const dayNum = daysBetween(lot.start_date, todayStr());
    const next = scheduleFor(lot.poultry_type).find(s => s.day > dayNum);
    const dayLabel = dayNum < 0 ? 'Not started yet' : `Day ${dayNum} of ${lot.cycle_days}`;
    const typeLabel = lot.poultry_type === 'layer' ? 'Layers' : 'Broilers';
    const lost = totalLost(lot);
    const remaining = lot.quantity != null ? lot.quantity - lost : null;
    const countLabel = remaining != null
      ? `${remaining} of ${lot.quantity} birds remaining${lost > 0 ? ` (${lost} lost)` : ''}`
      : (lost > 0 ? `${lost} lost` : '');
    return `
    <div class="animal-card" onclick="openLotModal(${lot.id})">
      <div class="top">
        <h3>${escapeHtml(lot.name)}</h3>
        <span class="pill ${lot.status==='active' ? 'active' : 'settled'}">${lot.status}</span>
      </div>
      <div class="meta">${typeLabel} \u00b7 started ${lot.start_date} \u00b7 ${dayLabel}</div>
      ${countLabel ? `<div class="meta" style="margin-top:2px;${lost>0?'color:var(--rust-600);font-weight:600;':''}">${countLabel}</div>` : ''}
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
  const lost = totalLost(lot);
  const remaining = lot.quantity != null ? lot.quantity - lost : null;
  const typeLabel = lot.poultry_type === 'layer' ? 'Layers' : 'Broilers';
  document.getElementById('modalLotTitle').textContent = lot.name;
  document.getElementById('modalLotMeta').textContent =
    [typeLabel, remaining != null ? `${remaining} of ${lot.quantity} birds remaining` : null, 'started ' + lot.start_date].filter(Boolean).join(' \u00b7 ');
  document.getElementById('modalLotStatus').value = lot.status;
  document.getElementById('lotRemDate').value = todayStr();
  document.getElementById('mortDate').value = todayStr();
  document.getElementById('lotModal').style.display = 'flex';
  loadLotReminders(id);
  loadMortality(id);
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

async function loadMortality(lotId){
  const rows = await api('/broiler-lots/'+lotId+'/mortality');
  const el = document.getElementById('mortalityList');
  if (rows.length===0){ el.innerHTML = '<div class="empty">No losses recorded.</div>'; return; }
  el.innerHTML = rows.map(m=>`
    <div class="item">
      <div><div class="name">${m.quantity_lost} lost</div><div class="meta">${m.event_date}${m.note ? ' \u00b7 '+escapeHtml(m.note) : ''}</div></div>
      ${removeBtn(`deleteMortality(${lotId}, ${m.id})`)}
    </div>`).join('');
}

document.getElementById('addMortBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('mortErr'); err.textContent = '';
  const event_date = document.getElementById('mortDate').value || todayStr();
  const quantity_lost = document.getElementById('mortQty').value;
  const note = document.getElementById('mortNote').value.trim();
  if (!quantity_lost || parseInt(quantity_lost,10) <= 0){ err.textContent = 'Enter how many were lost.'; return; }
  try{
    await api('/broiler-lots/'+state.currentLotId+'/mortality', { method:'POST', body:{ event_date, quantity_lost, note } });
    document.getElementById('mortQty').value = '';
    document.getElementById('mortNote').value = '';
    showToast('Loss recorded');
    await loadAll();
    const lot = state.lots.find(l=>l.id===state.currentLotId);
    const lost = totalLost(lot);
    const remaining = lot.quantity != null ? lot.quantity - lost : null;
    document.getElementById('modalLotMeta').textContent =
      [remaining != null ? `${remaining} of ${lot.quantity} birds remaining` : null, 'started ' + lot.start_date].filter(Boolean).join(' \u00b7 ');
    loadMortality(state.currentLotId);
  }catch(e){ err.textContent = e.message; }
});

async function deleteMortality(lotId, mortId){
  if (!confirm('Delete this loss record? This can\'t be undone.')) return;
  await api('/broiler-lots/'+lotId+'/mortality/'+mortId, { method:'DELETE' });
  await loadAll();
  loadMortality(lotId);
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

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function refreshPushButton(){
  const btn = document.getElementById('pushToggleBtn');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)){
    btn.textContent = 'Not supported on this browser';
    btn.disabled = true;
    return;
  }
  try{
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    btn.textContent = existing ? 'Notifications enabled \u2014 tap to disable' : 'Enable notifications on this device';
  }catch(e){ /* leave default label */ }
}

document.getElementById('pushToggleBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('pushErr'); err.textContent = '';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)){
    err.textContent = 'Push notifications aren\u2019t supported on this browser.';
    return;
  }
  try{
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing){
      await api('/push/unsubscribe', { method:'POST', body:{ endpoint: existing.endpoint } });
      await existing.unsubscribe();
      showToast('Notifications disabled on this device');
      await refreshPushButton();
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm !== 'granted'){ err.textContent = 'Notification permission was not granted.'; return; }

    const vapid = await api('/push/vapid-public-key');
    if (!vapid.configured){ err.textContent = 'Push notifications aren\u2019t set up on this server yet.'; return; }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
    });
    const subJson = sub.toJSON();
    await api('/push/subscribe', { method:'POST', body:{ endpoint: subJson.endpoint, keys: subJson.keys } });
    showToast('Notifications enabled on this device');
    await refreshPushButton();
  }catch(e){ err.textContent = e.message || 'Could not enable notifications.'; }
});

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
  if (!confirm('Delete this reminder? This can\'t be undone.')) return;
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
  return { debt:'Debt', animal:'Livestock', broiler_lot:'Broiler lot', custom:'General' }[t] || t;
}

// ---------------- TEAM ----------------
document.getElementById('addWorkerBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('wErr'); err.textContent = '';
  const name = document.getElementById('wName').value.trim();
  const phone = document.getElementById('wPhone').value.trim();
  const email = document.getElementById('wEmail').value.trim();
  const password = document.getElementById('wPassword').value;
  if (!name || !phone || !password){ err.textContent = 'Fill in every field.'; return; }
  try{
    await api('/users', { method:'POST', body:{ name, phone, email: email || null, password } });
    document.getElementById('wName').value = '';
    document.getElementById('wPhone').value = '';
    document.getElementById('wEmail').value = '';
    document.getElementById('wPassword').value = '';
    showToast('Added to the farm');
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

function renderUsers(){
  const el = document.getElementById('userList');
  if (state.users.length===0){ el.innerHTML = '<div class="empty">No one added yet.</div>'; return; }
  el.innerHTML = state.users.map(u=>`
    <div class="item">
      <div><div class="name">${escapeHtml(u.name)}</div><div class="meta">${escapeHtml(u.phone)}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="pill ${u.role==='owner' ? 'owe-me' : 'settled'}">${u.role}</span>
        ${isOwner() && u.role !== 'owner' ? `<button class="del" onclick="removeUser(${u.id})">Remove</button>` : ''}
      </div>
    </div>`).join('');
}

async function removeUser(id){
  if (!confirm('Remove this person from the farm? They will no longer be able to log in.')) return;
  try{
    await api('/users/'+id, { method:'DELETE' });
    showToast('Removed from the farm');
    await loadAll();
  }catch(e){ showToast(e.message); }
}

// ---------------- DASHBOARD ----------------
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

function txRowHtml(t){
  const animalLabels = { chicken: 'chicken', goat: 'goats', cow: 'cows' };
  const animalNote = t.livestock_type ? ` &middot; ${t.quantity} ${animalLabels[t.livestock_type] || t.livestock_type}` : '';
  return `
    <div class="item">
      <div><div class="name">${escapeHtml(t.description)}</div><div class="meta">${escapeHtml(t.category)} &middot; ${t.tx_date}${animalNote}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="amt ${t.type==='income'?'plus':'minus'}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount)}</div>
        <button class="del" style="color:var(--leaf-700)" onclick="openTxEditModal(${t.id})">Edit</button>
        ${removeBtn(`deleteTx(${t.id})`)}
      </div>
    </div>`;
}

function debtRowHtml(d){
  const animalLabels = { chicken: 'chicken', goat: 'goats', cow: 'cows' };
  const animalNote = d.livestock_type ? ` &middot; ${d.quantity} ${animalLabels[d.livestock_type] || d.livestock_type}` : '';
  return `
    <div class="item">
      <div><div class="name">${escapeHtml(d.person)}${d.phone ? ' <span class="meta">(' + escapeHtml(d.phone) + ')</span>' : ''}</div>
        <div class="meta">${escapeHtml(d.description||'')}${animalNote} ${d.due_date ? '&middot; due '+d.due_date : ''}</div></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="pill ${d.settled ? 'settled' : (d.direction==='owed_to_me'?'owe-me':'i-owe')}">${d.settled ? 'Settled' : (d.direction==='owed_to_me' ? 'Owes you' : 'You owe')}</span>
        <div class="amt">${fmtMoney(d.amount)}</div>
      </div>
    </div>
    <div style="display:flex;gap:14px;justify-content:flex-end;margin:-6px 0 8px;">
      <button class="del" style="color:var(--leaf-700)" onclick="toggleSettle(${d.id})">${d.settled?'Mark unsettled':'Mark settled'}</button>
      <button class="del" style="color:var(--leaf-700)" onclick="openDebtEditModal(${d.id})">Edit</button>
      ${removeBtn(`deleteDebt(${d.id})`)}
    </div>
  `;
}

const HISTORY_PREVIEW_LIMIT = 10;

function goToHistory(section){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab === 'history'));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id === 'history'));
  const card = document.getElementById(section === 'debts' ? 'debtHistoryCard' : 'txHistoryCard');
  if (card) card.scrollIntoView({ behavior:'smooth', block:'start' });
}

function renderTx(){
  const el = document.getElementById('txList');
  if (state.tx.length===0){ el.innerHTML = '<div class="empty">No transactions yet.</div>'; return; }
  const shown = state.tx.slice(0, HISTORY_PREVIEW_LIMIT);
  let html = shown.map(txRowHtml).join('');
  if (state.tx.length > HISTORY_PREVIEW_LIMIT){
    html += `<div style="text-align:center;padding-top:10px;">
      <button class="link-btn" onclick="goToHistory('transactions')">View all ${state.tx.length} transactions &rarr;</button>
    </div>`;
  }
  el.innerHTML = html;
}

function renderDebts(){
  const el = document.getElementById('debtList');
  if (state.debts.length===0){ el.innerHTML = '<div class="empty">No debts recorded.</div>'; return; }
  const shown = state.debts.slice(0, HISTORY_PREVIEW_LIMIT);
  let html = shown.map(debtRowHtml).join('');
  if (state.debts.length > HISTORY_PREVIEW_LIMIT){
    html += `<div style="text-align:center;padding-top:10px;">
      <button class="link-btn" onclick="goToHistory('debts')">View all ${state.debts.length} debts &rarr;</button>
    </div>`;
  }
  el.innerHTML = html;
}

function renderTxHistory(){
  const el = document.getElementById('txHistoryList');
  if (!el) return;
  el.innerHTML = state.tx.length === 0
    ? '<div class="empty">No transactions yet.</div>'
    : state.tx.map(txRowHtml).join('');
}

function renderDebtHistory(){
  const el = document.getElementById('debtHistoryList');
  if (!el) return;
  el.innerHTML = state.debts.length === 0
    ? '<div class="empty">No debts recorded.</div>'
    : state.debts.map(debtRowHtml).join('');
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

// ---------------- EDIT TRANSACTION ----------------
let txEditType = 'income';
let txEditId = null;

document.querySelectorAll('#txEditTypeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#txEditTypeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); txEditType = b.dataset.val;
  });
});
document.getElementById('txEditLivestockType').addEventListener('change', ()=>{
  const show = document.getElementById('txEditLivestockType').value !== '';
  document.getElementById('txEditQuantityLabel').style.display = show ? 'block' : 'none';
  document.getElementById('txEditQuantity').style.display = show ? 'block' : 'none';
});

function openTxEditModal(id){
  const t = state.tx.find(x=>x.id===id);
  if (!t) return;
  txEditId = id;
  txEditType = t.type;
  document.querySelectorAll('#txEditTypeSeg button').forEach(b=>b.classList.toggle('on', b.dataset.val === t.type));
  document.getElementById('txEditAmount').value = t.amount;
  document.getElementById('txEditDesc').value = t.description || '';
  document.getElementById('txEditCategory').value = t.category || 'Other';
  document.getElementById('txEditDate').value = t.tx_date;
  document.getElementById('txEditLivestockType').value = t.livestock_type || '';
  const showQty = !!t.livestock_type;
  document.getElementById('txEditQuantityLabel').style.display = showQty ? 'block' : 'none';
  document.getElementById('txEditQuantity').style.display = showQty ? 'block' : 'none';
  document.getElementById('txEditQuantity').value = t.quantity || '';
  document.getElementById('txEditErr').textContent = '';
  document.getElementById('txEditModal').style.display = 'flex';
}
function closeTxEditModal(){
  document.getElementById('txEditModal').style.display = 'none';
  txEditId = null;
}
document.getElementById('closeTxEditBtn').addEventListener('click', closeTxEditModal);

document.getElementById('saveTxEditBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('txEditErr'); err.textContent = '';
  const amount = parseFloat(document.getElementById('txEditAmount').value);
  const description = document.getElementById('txEditDesc').value.trim();
  const category = document.getElementById('txEditCategory').value;
  const tx_date = document.getElementById('txEditDate').value;
  const livestock_type = document.getElementById('txEditLivestockType').value || null;
  const quantityRaw = document.getElementById('txEditQuantity').value;
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (!description){ err.textContent = 'Add a short description.'; return; }
  if (livestock_type && (!quantityRaw || parseInt(quantityRaw,10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
  try{
    await api('/transactions/'+txEditId, { method:'PATCH', body:{
      type: txEditType, amount, description, category, tx_date,
      livestock_type, quantity: livestock_type ? quantityRaw : null
    }});
    showToast('Transaction updated');
    closeTxEditModal();
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});

// ---------------- EDIT DEBT ----------------
let debtEditDirection = 'owed_to_me';
let debtEditId = null;

document.querySelectorAll('#debtEditTypeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    if (b.disabled) return;
    document.querySelectorAll('#debtEditTypeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); debtEditDirection = b.dataset.val;
    const showPhone = debtEditDirection === 'owed_to_me';
    document.getElementById('debtEditPhoneLabel').style.display = showPhone ? 'block' : 'none';
    document.getElementById('debtEditPhone').style.display = showPhone ? 'block' : 'none';
  });
});
document.getElementById('debtEditLivestockType').addEventListener('change', ()=>{
  const show = document.getElementById('debtEditLivestockType').value !== '';
  document.getElementById('debtEditQuantityLabel').style.display = show ? 'block' : 'none';
  document.getElementById('debtEditQuantity').style.display = show ? 'block' : 'none';
});

function openDebtEditModal(id){
  const d = state.debts.find(x=>x.id===id);
  if (!d) return;
  debtEditId = id;
  debtEditDirection = d.direction;

  const financialLocked = !!d.settled;
  document.getElementById('debtEditSettledNote').style.display = financialLocked ? 'block' : 'none';
  document.querySelectorAll('#debtEditTypeSeg button').forEach(b=>{
    b.classList.toggle('on', b.dataset.val === d.direction);
    b.disabled = financialLocked;
    b.style.opacity = financialLocked ? '0.5' : '1';
    b.style.cursor = financialLocked ? 'not-allowed' : 'pointer';
  });
  document.getElementById('debtEditAmount').disabled = financialLocked;
  document.getElementById('debtEditLivestockType').disabled = financialLocked;
  document.getElementById('debtEditQuantity').disabled = financialLocked;

  document.getElementById('debtEditPerson').value = d.person;
  document.getElementById('debtEditPhone').value = d.phone || '';
  const showPhone = d.direction === 'owed_to_me';
  document.getElementById('debtEditPhoneLabel').style.display = showPhone ? 'block' : 'none';
  document.getElementById('debtEditPhone').style.display = showPhone ? 'block' : 'none';
  document.getElementById('debtEditAmount').value = d.amount;
  document.getElementById('debtEditDesc').value = d.description || '';
  document.getElementById('debtEditLivestockType').value = d.livestock_type || '';
  const showQty = !!d.livestock_type;
  document.getElementById('debtEditQuantityLabel').style.display = showQty ? 'block' : 'none';
  document.getElementById('debtEditQuantity').style.display = showQty ? 'block' : 'none';
  document.getElementById('debtEditQuantity').value = d.quantity || '';
  document.getElementById('debtEditDue').value = d.due_date || '';
  document.getElementById('debtEditErr').textContent = '';
  document.getElementById('debtEditModal').style.display = 'flex';
}
function closeDebtEditModal(){
  document.getElementById('debtEditModal').style.display = 'none';
  debtEditId = null;
}
document.getElementById('closeDebtEditBtn').addEventListener('click', closeDebtEditModal);

document.getElementById('saveDebtEditBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('debtEditErr'); err.textContent = '';
  const debt = state.debts.find(x=>x.id===debtEditId);
  const financialLocked = !!debt.settled;
  const person = document.getElementById('debtEditPerson').value.trim();
  const phone = document.getElementById('debtEditPhone').value.trim();
  const description = document.getElementById('debtEditDesc').value.trim();
  const due_date = document.getElementById('debtEditDue').value || null;
  if (!person){ err.textContent = 'Enter a name first.'; return; }

  const body = { person, description, due_date };
  body.phone = debtEditDirection === 'owed_to_me' ? (phone || null) : null;

  if (!financialLocked){
    const amount = parseFloat(document.getElementById('debtEditAmount').value);
    const livestock_type = document.getElementById('debtEditLivestockType').value || null;
    const quantityRaw = document.getElementById('debtEditQuantity').value;
    if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
    if (livestock_type && (!quantityRaw || parseInt(quantityRaw,10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
    body.direction = debtEditDirection;
    body.amount = amount;
    body.livestock_type = livestock_type;
    body.quantity = livestock_type ? quantityRaw : null;
  }

  try{
    await api('/debts/'+debtEditId, { method:'PATCH', body });
    showToast('Debt updated');
    closeDebtEditModal();
    await loadAll();
  }catch(e){ err.textContent = e.message; }
});
