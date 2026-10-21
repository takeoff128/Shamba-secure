const state = {
  tx: [], debts: [], animals: [], users: [], reminders: [], lots: [], schedule: [],
  currentAnimalId: null, currentLotId: null, currentTeamEditId: null,
  role: null, currency: 'KES', name: '', farmName: '', country: null,
  farmIcon: null, farmLogo: null
};

// A small, farm-relevant set — not meant to be exhaustive, just enough
// variety that most farms can find something that fits better than the
// generic lock icon used before any choice is made.
const FARM_ICON_CHOICES = ['\u{1F512}','\u{1F414}','\u{1F404}','\u{1F410}','\u{1F416}','\u{1F33E}','\u{1F6DC}','\u{1F3E1}','\u{1F95A}','\u{1F41D}'];

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

// The farm's branding (an uploaded logo image, a chosen emoji icon, or the
// default lock) shows in both the header and the drawer's own header, so
// this fills both from the same state rather than duplicating the markup
// logic at each call site.
function renderFarmMark(){
  const html = state.farmLogo
    ? `<img src="${state.farmLogo}" alt="">`
    : escapeHtml(state.farmIcon || '\u{1F512}');
  document.getElementById('farmMark').innerHTML = html;
  document.getElementById('drawerFarmMark').innerHTML = html;
}
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
  // Without a timeout, a slow/hung backend call (e.g. a stuck SMTP send)
  // leaves fetch waiting forever with nothing shown — looks exactly like
  // the page is frozen. 20s is generous but guarantees an actual error.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  let res;
  try{
    res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal
    });
  }catch(e){
    if (e.name === 'AbortError') throw new Error('That took too long to respond. Check your connection and try again.');
    throw new Error('Could not reach the server. Check your connection and try again.');
  }finally{
    clearTimeout(timeoutId);
  }
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
    if (b.dataset.val !== 'register') resetRegCodeStep();
    resetForgotForm();
  });
});

document.getElementById('showForgotBtn').addEventListener('click', ()=>{
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'block';
});
function resetForgotForm(){
  document.getElementById('forgotCodeStep').style.display = 'none';
  document.getElementById('forgotCode').value = '';
  document.getElementById('forgotNewPassword').value = '';
  document.getElementById('forgotConfirmPassword').value = '';
  document.getElementById('forgotBtn').textContent = 'Send reset code';
  document.getElementById('forgotErr').textContent = '';
  document.getElementById('forgotSuccess').textContent = '';
  forgotCodeSent = false;
}
document.getElementById('backToLoginBtn').addEventListener('click', ()=>{
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('forgotIdentifier').value = '';
  resetForgotForm();
});

// Same two-click pattern as registration: first click requests a code
// (sent via whichever channel — email or SMS — that account verified at
// signup), second click submits the code + new password.
let forgotCodeSent = false;
document.getElementById('forgotBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('forgotErr'); err.textContent = '';
  const success = document.getElementById('forgotSuccess'); success.textContent = '';
  const identifier = document.getElementById('forgotIdentifier').value.trim();
  if (!identifier){ err.textContent = 'Enter your phone number or email.'; return; }

  if (!forgotCodeSent){
    try{
      const res = await api('/forgot-password', { method:'POST', body:{ identifier } });
      success.textContent = res.message;
      forgotCodeSent = true;
      document.getElementById('forgotCodeStep').style.display = 'block';
      document.getElementById('forgotBtn').textContent = 'Reset password';
    }catch(e){ err.textContent = e.message; }
    return;
  }

  const code = document.getElementById('forgotCode').value.trim();
  const password = document.getElementById('forgotNewPassword').value;
  const confirm = document.getElementById('forgotConfirmPassword').value;
  if (!code){ err.textContent = 'Enter the code you were sent.'; return; }
  if (!password || password.length < 6){ err.textContent = 'Password must be at least 6 characters.'; return; }
  if (password !== confirm){ err.textContent = "Passwords don't match."; return; }
  try{
    await api('/reset-password', { method:'POST', body:{ identifier, code, password } });
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('forgotIdentifier').value = '';
    resetForgotForm();
    showToast('Password reset — log in with your new password.');
  }catch(e){ err.textContent = e.message; }
});
document.getElementById('forgotResendBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('forgotErr'); err.textContent = '';
  const identifier = document.getElementById('forgotIdentifier').value.trim();
  if (!identifier){ err.textContent = 'Enter your phone number or email first.'; return; }
  try{
    const res = await api('/forgot-password', { method:'POST', body:{ identifier } });
    document.getElementById('forgotSuccess').textContent = res.message;
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

// Registration now happens in two clicks on the same form: the first click
// sends a verification code via whichever channel (email or phone) is
// selected and reveals the code field; the second click (with the code
// filled in) actually creates the account. regCodeSent/regCodeSentFor
// track which phase we're in and what contact the pending code is for.
let regVerifyChannel = 'email';
let regCodeSent = false;
let regCodeSentFor = '';

document.querySelectorAll('#regVerifySeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#regVerifySeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    regVerifyChannel = b.dataset.val;
    resetRegCodeStep();
  });
});

function currentRegContact(){
  return regVerifyChannel === 'email'
    ? document.getElementById('regEmail').value.trim()
    : document.getElementById('regPhone').value.trim();
}

function resetRegCodeStep(){
  regCodeSent = false;
  regCodeSentFor = '';
  document.getElementById('regCodeStep').style.display = 'none';
  document.getElementById('regCode').value = '';
  document.getElementById('regBtn').textContent = 'Create farm account';
}

document.getElementById('regBtn').addEventListener('click', async ()=>{
  const farmName = document.getElementById('regFarmName').value.trim();
  const name = document.getElementById('regName').value.trim();
  const currency = document.getElementById('regCurrency').value;
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const err = document.getElementById('regErr');
  const btn = document.getElementById('regBtn');
  err.textContent = '';
  if (!farmName || !name || !phone || !email || !password){ err.textContent = 'Fill in every field.'; return; }

  const contact = currentRegContact();
  const sendingCode = !regCodeSent || regCodeSentFor !== contact;
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = sendingCode ? 'Sending code\u2026' : 'Creating account\u2026';

  if (sendingCode){
    try{
      await api('/register/send-code', { method:'POST', body:{ channel: regVerifyChannel, contact, farmName } });
      regCodeSent = true;
      regCodeSentFor = contact;
      document.getElementById('regCodeNote').textContent =
        regVerifyChannel === 'email'
          ? `We emailed a 6-digit code to ${contact}. Enter it below to finish creating your account.`
          : `We texted a 6-digit code to ${contact}. Enter it below to finish creating your account.`;
      document.getElementById('regCodeStep').style.display = 'block';
      btn.textContent = 'Verify & create account';
      showToast(regVerifyChannel === 'email' ? 'Verification code sent to your email' : 'Verification code texted to your phone');
    }catch(e){
      err.textContent = e.message;
      btn.textContent = originalLabel;
    }finally{
      btn.disabled = false;
    }
    return;
  }

  const code = document.getElementById('regCode').value.trim();
  if (!code){ err.textContent = 'Enter the code you were sent.'; btn.disabled = false; btn.textContent = originalLabel; return; }
  try{
    await api('/register', { method:'POST', body:{ farmName, name, phone, email, password, currency, code, verify_channel: regVerifyChannel } });
    resetRegCodeStep();
    await enterApp();
  }catch(e){
    err.textContent = e.message;
    btn.textContent = originalLabel;
  }finally{
    btn.disabled = false;
  }
});

document.getElementById('regResendCodeBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('regErr'); err.textContent = '';
  const farmName = document.getElementById('regFarmName').value.trim();
  const contact = currentRegContact();
  if (!contact){ err.textContent = regVerifyChannel === 'email' ? 'Enter your email address first.' : 'Enter your phone number first.'; return; }
  try{
    await api('/register/send-code', { method:'POST', body:{ channel: regVerifyChannel, contact, farmName } });
    showToast('A new code has been sent.');
  }catch(e){ err.textContent = e.message; }
});

// If they change the field a code was sent to, that code is now for the
// wrong contact — fall back to step 1 so a fresh one gets sent.
document.getElementById('regEmail').addEventListener('input', ()=>{
  if (regVerifyChannel === 'email' && regCodeSent && document.getElementById('regEmail').value.trim() !== regCodeSentFor){
    resetRegCodeStep();
  }
});
document.getElementById('regPhone').addEventListener('input', ()=>{
  if (regVerifyChannel === 'phone' && regCodeSent && document.getElementById('regPhone').value.trim() !== regCodeSentFor){
    resetRegCodeStep();
  }
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
  state.name = me.name;
  state.farmName = me.farmName;
  state.country = me.country || null;
  state.farmIcon = me.farmIcon || null;
  state.farmLogo = me.farmLogo || null;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  document.getElementById('farmNameLabel').textContent = me.farmName;
  document.getElementById('userLabel').textContent = me.name + ' \u00b7 ' + (me.role === 'owner' ? 'Owner' : 'Worker');
  document.getElementById('drawerFarmNameLabel').textContent = me.farmName;
  document.getElementById('drawerUserLabel').textContent = me.name + ' \u00b7 ' + (me.role === 'owner' ? 'Owner' : 'Worker');
  renderFarmMark();
  document.getElementById('addWorkerCard').style.display = me.role === 'owner' ? 'block' : 'none';
  document.getElementById('farmSettingsPointer').style.display = me.role === 'owner' ? 'block' : 'none';
  document.getElementById('farmSettingsOwnerOnly').style.display = me.role === 'owner' ? 'block' : 'none';
  document.getElementById('farmSettingsReadonlyNote').style.display = me.role === 'owner' ? 'none' : 'block';
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
  renderIconPicker();
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

// ---------------- HAMBURGER MENU / DRAWER ----------------
function openDrawer(){
  document.getElementById('sideDrawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'true');
}
function closeDrawer(){
  document.getElementById('sideDrawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'false');
}
document.getElementById('hamburgerBtn').addEventListener('click', openDrawer);
document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeDrawer(); });
// Picking a section closes the drawer too, since it's covering the content
// just chosen — the .tab-btn listener above already handles the switch.
document.querySelectorAll('.drawer-item.tab-btn').forEach(btn => btn.addEventListener('click', closeDrawer));
document.getElementById('drawerLogoutBtn').addEventListener('click', ()=> document.getElementById('logoutBtn').click());

// ---------------- PROFILE & FARM SETTINGS ----------------
function openProfileModal(){
  closeDrawer();
  document.getElementById('profileName').value = state.name;
  document.getElementById('profileNameErr').textContent = '';
  document.getElementById('farmSettingsErr').textContent = '';
  if (isOwner()){
    document.getElementById('farmNameInput').value = state.farmName;
    document.getElementById('farmCountryInput').value = state.country || '';
    document.getElementById('farmCurrency').value = state.currency;
    renderIconPicker();
    updateLogoPreview();
  }
  document.getElementById('profileModal').style.display = 'flex';
}
function closeProfileModal(){ document.getElementById('profileModal').style.display = 'none'; }
document.getElementById('openProfileBtn').addEventListener('click', openProfileModal);
document.getElementById('openProfileBtn').addEventListener('keydown', (e)=>{
  if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openProfileModal(); }
});
document.getElementById('drawerProfileBtn').addEventListener('click', openProfileModal);
document.getElementById('closeProfileBtn').addEventListener('click', closeProfileModal);

document.getElementById('saveProfileNameBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('profileNameErr'); err.textContent = '';
  const name = document.getElementById('profileName').value.trim();
  if (!name){ err.textContent = 'Enter your name.'; return; }
  try{
    await api('/me', { method:'PATCH', body:{ name } });
    state.name = name;
    const label = name + ' · ' + (state.role === 'owner' ? 'Owner' : 'Worker');
    document.getElementById('userLabel').textContent = label;
    document.getElementById('drawerUserLabel').textContent = label;
    showToast('Name updated');
  }catch(e){ err.textContent = e.message; }
});

function renderIconPicker(){
  const el = document.getElementById('iconPicker');
  if (!el) return;
  el.innerHTML = FARM_ICON_CHOICES.map(icon => `
    <button type="button" class="${!state.farmLogo && state.farmIcon === icon ? 'on' : ''}" data-icon="${icon}">${icon}</button>
  `).join('');
  el.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const icon = btn.dataset.icon;
      try{
        await api('/farm', { method:'PATCH', body:{ icon_emoji: icon, logo_image: null } });
        state.farmIcon = icon;
        state.farmLogo = null;
        renderFarmMark();
        renderIconPicker();
        updateLogoPreview();
        showToast('Farm icon updated');
      }catch(e){ document.getElementById('farmSettingsErr').textContent = e.message; }
    });
  });
}

function updateLogoPreview(){
  const wrap = document.getElementById('farmLogoPreviewWrap');
  const img = document.getElementById('farmLogoPreview');
  if (state.farmLogo){
    img.src = state.farmLogo;
    wrap.style.display = 'flex';
  } else {
    wrap.style.display = 'none';
  }
}

// Resizes/compresses the image client-side before it ever leaves the
// browser, so what gets stored (as a data URL, straight in the farms
// table) stays small no matter how large the original photo was — no
// server-side image library needed for that.
function resizeImageFile(file, maxSize){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file does not look like an image.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('farmLogoInput').addEventListener('change', async (e)=>{
  const err = document.getElementById('farmSettingsErr'); err.textContent = '';
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')){ err.textContent = 'Choose an image file.'; e.target.value = ''; return; }
  try{
    const dataUrl = await resizeImageFile(file, 160);
    await api('/farm', { method:'PATCH', body:{ logo_image: dataUrl, icon_emoji: null } });
    state.farmLogo = dataUrl;
    state.farmIcon = null;
    renderFarmMark();
    renderIconPicker();
    updateLogoPreview();
    showToast('Farm logo updated');
  }catch(err2){ err.textContent = err2.message; }
  finally{ e.target.value = ''; }
});

document.getElementById('removeFarmLogoBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('farmSettingsErr'); err.textContent = '';
  try{
    await api('/farm', { method:'PATCH', body:{ logo_image: null } });
    state.farmLogo = null;
    renderFarmMark();
    renderIconPicker();
    updateLogoPreview();
    showToast('Logo removed');
  }catch(e){ err.textContent = e.message; }
});

document.getElementById('saveFarmSettingsBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('farmSettingsErr'); err.textContent = '';
  const name = document.getElementById('farmNameInput').value.trim();
  const currency = document.getElementById('farmCurrency').value;
  const country = document.getElementById('farmCountryInput').value.trim();
  if (!name){ err.textContent = 'Farm name cannot be empty.'; return; }
  try{
    await api('/farm', { method:'PATCH', body:{ name, currency, country: country || null } });
    state.currency = currency;
    state.farmName = name;
    state.country = country || null;
    document.getElementById('farmNameLabel').textContent = name;
    document.getElementById('drawerFarmNameLabel').textContent = name;
    showToast('Farm settings saved');
    renderAll();
  }catch(e){ err.textContent = e.message; }
});

// ---------------- EDIT TEAM MEMBER ----------------
function openTeamEditModal(id){
  const u = state.users.find(x=>x.id===id);
  if (!u) return;
  state.currentTeamEditId = id;
  document.getElementById('teamEditName').value = u.name;
  document.getElementById('teamEditPhone').value = u.phone;
  document.getElementById('teamEditEmail').value = u.email || '';
  document.getElementById('teamEditErr').textContent = '';
  document.getElementById('teamEditModal').style.display = 'flex';
}
function closeTeamEditModal(){
  document.getElementById('teamEditModal').style.display = 'none';
  state.currentTeamEditId = null;
}
document.getElementById('closeTeamEditBtn').addEventListener('click', closeTeamEditModal);
document.getElementById('saveTeamEditBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('teamEditErr'); err.textContent = '';
  const name = document.getElementById('teamEditName').value.trim();
  const phone = document.getElementById('teamEditPhone').value.trim();
  const email = document.getElementById('teamEditEmail').value.trim();
  if (!name){ err.textContent = 'Enter a name.'; return; }
  if (!phone){ err.textContent = 'Enter a phone number.'; return; }
  try{
    await api('/users/'+state.currentTeamEditId, { method:'PATCH', body:{ name, phone, email: email || null } });
    showToast('Saved');
    closeTeamEditModal();
    // Covers the case where the owner just edited their own row too — this
    // re-fetches /me and refreshes the header/drawer labels along with the
    // rest of the farm's data, not just the team list.
    await enterApp();
  }catch(e){ err.textContent = e.message; }
});

// ---------------- EDIT ANIMAL DETAILS ----------------
document.getElementById('saveAnimalDetailsBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('modalAnEditErr'); err.textContent = '';
  const tag_id = document.getElementById('modalAnTag').value.trim();
  const species = document.getElementById('modalAnSpecies').value;
  const breed = document.getElementById('modalAnBreed').value.trim();
  const sex = document.getElementById('modalAnSex').value;
  const dob = document.getElementById('modalAnDob').value || null;
  const acquired_date = document.getElementById('modalAnAcquired').value || null;
  const notes = document.getElementById('modalAnNotes').value.trim();
  if (!tag_id){ err.textContent = 'Tag ID is required.'; return; }
  try{
    await api('/animals/'+state.currentAnimalId, { method:'PATCH', body:{ tag_id, species, breed, sex, dob, acquired_date, notes } });
    showToast('Details saved');
    const keepId = state.currentAnimalId;
    await loadAll();
    openAnimalModal(keepId);
  }catch(e){ err.textContent = e.message; }
});

// ---------------- EDIT LOT DETAILS ----------------
document.getElementById('saveLotDetailsBtn').addEventListener('click', async ()=>{
  const err = document.getElementById('modalLotEditErr'); err.textContent = '';
  const name = document.getElementById('modalLotName').value.trim();
  const quantityRaw = document.getElementById('modalLotQuantity').value;
  const start_date = document.getElementById('modalLotStartDate').value;
  if (!name){ err.textContent = 'Give this lot a name or tag.'; return; }
  if (!start_date){ err.textContent = 'Pick a start date.'; return; }
  try{
    await api('/broiler-lots/'+state.currentLotId, {
      method:'PATCH',
      body:{ name, quantity: quantityRaw || null, start_date }
    });
    showToast('Details saved');
    const keepId = state.currentLotId;
    await loadAll();
    openLotModal(keepId);
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
  renderScheduleRef(); renderLots(); renderAnimalSalesSummary(); renderLotSelects();
  renderTxHistory(); renderDebtHistory();
  renderLotFilters(); renderPerformance();
}

// Fills the "Lot (optional)" dropdowns on the transaction/debt add & edit
// forms from state.lots, keeping whatever was already selected if it's
// still a valid choice.
function renderLotSelects(){
  const ids = ['txLot', 'txEditLot', 'debtLot', 'debtEditLot'];
  const options = state.lots.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Not lot-specific</option>' + options;
    if (state.lots.some(l => String(l.id) === current)) el.value = current;
  });
}

// ---------------- TRANSACTIONS ----------------
document.getElementById('txDate').value = todayStr();
// Animal type/pieces only makes sense for money coming IN (an animal sale) —
// "Sales by animal type" only ever counts income anyway, so there's nothing
// for it to do on an expense. Hide it there, and clear any stale value so
// switching to Money out never silently submits a leftover animal tag.
let txType = 'income';
function updateTxAnimalRowVisibility(){
  const show = txType === 'income';
  document.getElementById('txAnimalRow').style.display = show ? 'flex' : 'none';
  if (!show){
    document.getElementById('txLivestockType').value = '';
    document.getElementById('txQuantity').value = '';
    document.getElementById('txQuantityLabel').style.display = 'none';
    document.getElementById('txQuantity').style.display = 'none';
  }
}
document.querySelectorAll('#txTypeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#txTypeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); txType = b.dataset.val;
    updateTxAnimalRowVisibility();
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
  const lot_id = document.getElementById('txLot').value || null;
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (!description){ err.textContent = 'Add a short description.'; return; }
  if (livestock_type && (!quantityRaw || parseInt(quantityRaw, 10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
  try{
    await api('/transactions', { method:'POST', body:{
      type:txType, amount, category, description, tx_date,
      livestock_type, quantity: livestock_type ? quantityRaw : null, lot_id
    }});
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    document.getElementById('txLivestockType').value = '';
    document.getElementById('txQuantity').value = '';
    document.getElementById('txQuantityLabel').style.display = 'none';
    document.getElementById('txQuantity').style.display = 'none';
    document.getElementById('txLot').value = '';
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
document.getElementById('debtIncurred').value = todayStr();
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
  const incurred_date = document.getElementById('debtIncurred').value || todayStr();
  const due_date = document.getElementById('debtDue').value || null;
  const livestock_type = document.getElementById('debtLivestockType').value || null;
  const quantityRaw = document.getElementById('debtQuantity').value;
  const lot_id = document.getElementById('debtLot').value || null;
  if (!person){ err.textContent = 'Enter a name first.'; return; }
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (livestock_type && (!quantityRaw || parseInt(quantityRaw, 10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
  try{
    await api('/debts', { method:'POST', body:{
      direction:debtDirection, person,
      phone: debtDirection === 'owed_to_me' ? (phone || null) : null,
      amount, description, incurred_date, due_date,
      livestock_type, quantity: livestock_type ? quantityRaw : null, lot_id
    }});
    document.getElementById('debtPerson').value = '';
    document.getElementById('debtPhone').value = '';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDesc').value = '';
    document.getElementById('debtIncurred').value = todayStr();
    document.getElementById('debtDue').value = '';
    document.getElementById('debtLivestockType').value = '';
    document.getElementById('debtQuantity').value = '';
    document.getElementById('debtQuantityLabel').style.display = 'none';
    document.getElementById('debtQuantity').style.display = 'none';
    document.getElementById('debtLot').value = '';
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
  document.getElementById('modalAnTag').value = animal.tag_id;
  document.getElementById('modalAnSpecies').value = animal.species;
  document.getElementById('modalAnBreed').value = animal.breed || '';
  document.getElementById('modalAnSex').value = animal.sex || '';
  document.getElementById('modalAnDob').value = animal.dob || '';
  document.getElementById('modalAnAcquired').value = animal.acquired_date || '';
  document.getElementById('modalAnNotes').value = animal.notes || '';
  document.getElementById('modalAnEditErr').textContent = '';
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

function computeLotFinances(lot){
  // Same double-counting rule as "Sales by animal type": a cash transaction
  // auto-created by settling a debt is excluded here since the underlying
  // debt below is already counted — a sale counts once, the moment it's
  // recorded, whether it was ever on credit or not.
  const cashTx = state.tx.filter(t => t.lot_id === lot.id && t.category !== 'Debt settlement');
  const creditDebts = state.debts.filter(d => d.lot_id === lot.id);
  const income = cashTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
    + creditDebts.filter(d=>d.direction==='owed_to_me').reduce((s,d)=>s+d.amount,0);
  const expense = cashTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
    + creditDebts.filter(d=>d.direction==='i_owe').reduce((s,d)=>s+d.amount,0);
  const piecesSold = cashTx.filter(t=>t.type==='income').reduce((s,t)=>s+(t.quantity||0),0)
    + creditDebts.filter(d=>d.direction==='owed_to_me').reduce((s,d)=>s+(d.quantity||0),0);
  const piecesBought = cashTx.filter(t=>t.type==='expense').reduce((s,t)=>s+(t.quantity||0),0)
    + creditDebts.filter(d=>d.direction==='i_owe').reduce((s,d)=>s+(d.quantity||0),0);
  return { income, expense, net: income - expense, piecesSold, piecesBought };
}

function renderLotFinances(lot){
  const f = computeLotFinances(lot);
  const stats = [
    { label:'Income', value: fmtMoney(f.income), icon:'\u{1F4B0}', cls:'pos' },
    { label:'Expenses', value: fmtMoney(f.expense), icon:'\u{1F4B8}', cls:'neg' },
    { label:'Net', value: fmtMoney(f.net), icon:'⚖️', cls: f.net>=0?'pos':'neg' },
    { label:'Birds sold', value: String(f.piecesSold), icon:'\u{1F414}', cls:'' }
  ];
  if (f.piecesBought > 0) stats.push({ label:'Birds bought', value: String(f.piecesBought), icon:'\u{1F423}', cls:'' });
  document.getElementById('modalLotFinances').innerHTML = stats.map(s=>`
    <div class="stat ${s.cls}">
      <div class="stat-icon">${s.icon}</div>
      <div class="label">${s.label}</div>
      <div class="value">${s.value}</div>
    </div>`).join('');
}

function openLotModal(id){
  state.currentLotId = id;
  const lot = state.lots.find(l=>l.id===id);
  const lost = totalLost(lot);
  const remaining = lot.quantity != null ? lot.quantity - lost : null;
  const typeLabel = lot.poultry_type === 'layer' ? 'Layers' : 'Broilers';
  document.getElementById('modalLotTitle').textContent = lot.name;
  document.getElementById('modalLotMeta').textContent =
    [typeLabel, remaining != null ? `${remaining} of ${lot.quantity} birds remaining` : null, 'started ' + lot.start_date, 'matures ' + lotMaturityDate(lot)].filter(Boolean).join(' \u00b7 ');
  renderLotFinances(lot);
  document.getElementById('modalLotStatus').value = lot.status;
  document.getElementById('modalLotName').value = lot.name;
  document.getElementById('modalLotQuantity').value = lot.quantity || '';
  document.getElementById('modalLotStartDate').value = lot.start_date;
  document.getElementById('modalLotEditErr').textContent = '';
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
        ${isOwner() ? `<button class="del" style="color:var(--leaf-700)" onclick="openTeamEditModal(${u.id})">Edit</button>` : ''}
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
    <div class="stat ${net>=0?'pos':'neg'}"><div class="stat-icon">⚖️</div><div class="label">Net balance</div><div class="value">${fmtMoney(net)}</div></div>
    <div class="stat pos"><div class="stat-icon">\u{1F4C8}</div><div class="label">Total in</div><div class="value">${fmtMoney(income)}</div></div>
    <div class="stat neg"><div class="stat-icon">\u{1F4C9}</div><div class="label">Total out</div><div class="value">${fmtMoney(expense)}</div></div>
  `;
  const owedToMe = state.debts.filter(d=>d.direction==='owed_to_me' && !d.settled).reduce((s,d)=>s+d.amount,0);
  const iOwe = state.debts.filter(d=>d.direction==='i_owe' && !d.settled).reduce((s,d)=>s+d.amount,0);
  document.getElementById('dashOwedToMe').textContent = fmtMoney(owedToMe);
  document.getElementById('dashIOwe').textContent = fmtMoney(iOwe);

  const active = state.animals.filter(a=>a.status==='active').length;
  const sold = state.animals.filter(a=>a.status==='sold').length;
  const deceased = state.animals.filter(a=>a.status==='deceased').length;
  document.getElementById('dashHerd').innerHTML = `
    <div class="stat pos"><div class="stat-icon">\u{1F7E2}</div><div class="label">Active</div><div class="value">${active}</div></div>
    <div class="stat"><div class="stat-icon">\u{1F4B5}</div><div class="label">Sold</div><div class="value">${sold}</div></div>
    <div class="stat neg"><div class="stat-icon">✕</div><div class="label">Deceased</div><div class="value">${deceased}</div></div>
  `;
}

function txRowHtml(t){
  const animalLabels = { chicken: 'chicken', goat: 'goats', cow: 'cows' };
  const animalNote = t.livestock_type ? ` &middot; ${t.quantity} ${animalLabels[t.livestock_type] || t.livestock_type}` : '';
  const lot = t.lot_id ? state.lots.find(l=>l.id===t.lot_id) : null;
  const lotNote = lot ? ` &middot; ${escapeHtml(lot.name)}` : '';
  return `
    <div class="item">
      <div><div class="name">${escapeHtml(t.description)}</div><div class="meta">${escapeHtml(t.category)} &middot; ${t.tx_date}${animalNote}${lotNote}</div></div>
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
  const lot = d.lot_id ? state.lots.find(l=>l.id===d.lot_id) : null;
  const lotNote = lot ? ` &middot; ${escapeHtml(lot.name)}` : '';
  return `
    <div class="item">
      <div><div class="name">${escapeHtml(d.person)}${d.phone ? ' <span class="meta">(' + escapeHtml(d.phone) + ')</span>' : ''}</div>
        <div class="meta">${escapeHtml(d.description||'')}${animalNote}${lotNote} ${d.due_date ? '&middot; due '+d.due_date : ''}</div></div>
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
  document.getElementById('historyModal').style.display = 'flex';
  const card = document.getElementById(section === 'debts' ? 'debtHistoryCard' : 'txHistoryCard');
  if (card) card.scrollIntoView({ behavior:'smooth', block:'start' });
}
document.getElementById('closeHistoryBtn').addEventListener('click', ()=>{
  document.getElementById('historyModal').style.display = 'none';
});

function renderTx(){
  const el = document.getElementById('txList');
  const all = filteredTx();
  if (all.length===0){ el.innerHTML = '<div class="empty">' + (isLotFiltered() ? 'No transactions match this lot.' : 'No transactions yet.') + '</div>'; return; }
  const shown = all.slice(0, HISTORY_PREVIEW_LIMIT);
  let html = shown.map(txRowHtml).join('');
  if (all.length > HISTORY_PREVIEW_LIMIT){
    html += `<div style="text-align:center;padding-top:10px;">
      <button class="link-btn" onclick="goToHistory('transactions')">View all ${all.length} transactions &rarr;</button>
    </div>`;
  }
  el.innerHTML = html;
}

function renderDebts(){
  const el = document.getElementById('debtList');
  const all = filteredDebts();
  if (all.length===0){ el.innerHTML = '<div class="empty">' + (isLotFiltered() ? 'No debts match this lot.' : 'No debts recorded.') + '</div>'; return; }
  const shown = all.slice(0, HISTORY_PREVIEW_LIMIT);
  let html = shown.map(debtRowHtml).join('');
  if (all.length > HISTORY_PREVIEW_LIMIT){
    html += `<div style="text-align:center;padding-top:10px;">
      <button class="link-btn" onclick="goToHistory('debts')">View all ${all.length} debts &rarr;</button>
    </div>`;
  }
  el.innerHTML = html;
}

function renderTxHistory(){
  const el = document.getElementById('txHistoryList');
  if (!el) return;
  const all = filteredTx();
  el.innerHTML = all.length === 0
    ? '<div class="empty">' + (isLotFiltered() ? 'No transactions match this lot.' : 'No transactions yet.') + '</div>'
    : all.map(txRowHtml).join('');
}

function renderDebtHistory(){
  const el = document.getElementById('debtHistoryList');
  if (!el) return;
  const all = filteredDebts();
  el.innerHTML = all.length === 0
    ? '<div class="empty">' + (isLotFiltered() ? 'No debts match this lot.' : 'No debts recorded.') + '</div>'
    : all.map(debtRowHtml).join('');
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

function updateTxEditAnimalRowVisibility(){
  const show = txEditType === 'income';
  document.getElementById('txEditAnimalRow').style.display = show ? 'flex' : 'none';
  if (!show){
    document.getElementById('txEditLivestockType').value = '';
    document.getElementById('txEditQuantity').value = '';
    document.getElementById('txEditQuantityLabel').style.display = 'none';
    document.getElementById('txEditQuantity').style.display = 'none';
  }
}
document.querySelectorAll('#txEditTypeSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('#txEditTypeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); txEditType = b.dataset.val;
    updateTxEditAnimalRowVisibility();
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
  updateTxEditAnimalRowVisibility();
  document.getElementById('txEditAmount').value = t.amount;
  document.getElementById('txEditDesc').value = t.description || '';
  document.getElementById('txEditCategory').value = t.category || 'Other';
  document.getElementById('txEditDate').value = t.tx_date;
  document.getElementById('txEditLivestockType').value = t.livestock_type || '';
  const showQty = !!t.livestock_type;
  document.getElementById('txEditQuantityLabel').style.display = showQty ? 'block' : 'none';
  document.getElementById('txEditQuantity').style.display = showQty ? 'block' : 'none';
  document.getElementById('txEditQuantity').value = t.quantity || '';
  document.getElementById('txEditLot').value = t.lot_id ? String(t.lot_id) : '';
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
  const lot_id = document.getElementById('txEditLot').value || null;
  if (!amount || amount <= 0){ err.textContent = 'Enter an amount first.'; return; }
  if (!description){ err.textContent = 'Add a short description.'; return; }
  if (livestock_type && (!quantityRaw || parseInt(quantityRaw,10) <= 0)){ err.textContent = 'Enter how many pieces.'; return; }
  try{
    await api('/transactions/'+txEditId, { method:'PATCH', body:{
      type: txEditType, amount, description, category, tx_date,
      livestock_type, quantity: livestock_type ? quantityRaw : null, lot_id
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
  document.getElementById('debtEditLot').value = d.lot_id ? String(d.lot_id) : '';
  document.getElementById('debtEditIncurred').value = d.incurred_date || '';
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
  const incurred_date = document.getElementById('debtEditIncurred').value || null;
  const due_date = document.getElementById('debtEditDue').value || null;
  const lot_id = document.getElementById('debtEditLot').value || null;
  if (!person){ err.textContent = 'Enter a name first.'; return; }

  const body = { person, description, incurred_date, due_date, lot_id };
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


// ---- Login/register polish: show/hide password + mode-aware heading ----
(function(){
  ['loginPassword','regPassword','forgotNewPassword','forgotConfirmPassword'].forEach(id=>{
    const inp=document.getElementById(id); if(!inp) return;
    const wrap=document.createElement('div'); wrap.className='pw-wrap';
    inp.parentNode.insertBefore(wrap,inp); wrap.appendChild(inp);
    const b=document.createElement('button'); b.type='button'; b.className='pw-toggle'; b.textContent='Show';
    b.addEventListener('click',()=>{const s=inp.type==='password'; inp.type=s?'text':'password'; b.textContent=s?'Hide':'Show';});
    wrap.appendChild(b);
  });
  const t=document.getElementById('authWelcome'), s=document.getElementById('authSub');
  const copy={login:['Welcome back','Log in to see how your farm is doing.'],
              register:['Start your farm','Set up your account in about a minute.']};
  document.querySelectorAll('#authModeSeg button').forEach(b=>b.addEventListener('click',()=>{
    const c=copy[b.dataset.val]; if(c&&t&&s){t.textContent=c[0]; s.textContent=c[1];}
  }));
})();


// =====================================================================
// Lot filter (transactions / debts / history) and lot performance charts
// =====================================================================
state.lotFilter = '';          // '' = all records, 'none' = farm-wide only, else a lot id
state.fromMaturity = false;    // when a lot is picked: only records dated on/after it matured
state.perf = { scope:'all', metric:'expense', chart:'bar' };

function addDaysStr(dateStr, n){
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + (n||0));
  return d.toISOString().slice(0,10);
}
function lotMaturityDate(lot){ return addDaysStr(lot.start_date, lot.cycle_days || 28); }
function daysBetween(a, b){ return Math.round((new Date(b+'T00:00:00Z') - new Date(a+'T00:00:00Z')) / 86400000); }
function selectedLot(){
  if (!state.lotFilter || state.lotFilter === 'none') return null;
  return state.lots.find(l => String(l.id) === String(state.lotFilter)) || null;
}
function isLotFiltered(){ return !!state.lotFilter; }

function filteredTx(){
  if (!state.lotFilter) return state.tx;
  if (state.lotFilter === 'none') return state.tx.filter(t => !t.lot_id);
  const lot = selectedLot();
  if (!lot) return state.tx;
  const from = state.fromMaturity ? lotMaturityDate(lot) : null;
  return state.tx.filter(t => t.lot_id === lot.id && (!from || t.tx_date >= from));
}
function filteredDebts(){
  if (!state.lotFilter) return state.debts;
  if (state.lotFilter === 'none') return state.debts.filter(d => !d.lot_id);
  const lot = selectedLot();
  if (!lot) return state.debts;
  const from = state.fromMaturity ? lotMaturityDate(lot) : null;
  return state.debts.filter(d => d.lot_id === lot.id && (!from || (d.incurred_date || '') >= from));
}

function lotFilterHtml(){
  const lot = selectedLot();
  const opts = '<option value="">All records</option><option value="none">Farm-wide only (no lot)</option>'
    + state.lots.map(l => `<option value="${l.id}"${String(l.id)===String(state.lotFilter)?' selected':''}>${escapeHtml(l.name)}</option>`).join('');
  let extra = '';
  if (lot){
    const mat = lotMaturityDate(lot);
    const diff = daysBetween(todayStr(), mat);
    const when = diff > 0 ? `in ${diff} day${diff===1?'':'s'}` : diff === 0 ? 'today' : `${-diff} day${diff===-1?'':'s'} ago`;
    const tx = filteredTx(), debts = filteredDebts();
    const inc = tx.filter(t=>t.type==='income' && t.category!=='Debt settlement').reduce((s,t)=>s+t.amount,0)
      + debts.filter(d=>d.direction==='owed_to_me').reduce((s,d)=>s+d.amount,0);
    const exp = tx.filter(t=>t.type==='expense' && t.category!=='Debt settlement').reduce((s,t)=>s+t.amount,0)
      + debts.filter(d=>d.direction==='i_owe').reduce((s,d)=>s+d.amount,0);
    const net = inc - exp;
    extra = `
      <label class="lf-check"><input type="checkbox" class="lf-mature"${state.fromMaturity?' checked':''}> Only from the maturity date (${mat})</label>
      <div class="lot-summary"><b>${escapeHtml(lot.name)}</b> started ${lot.start_date} &middot; matures ${mat} (${when})<br>
        Income <span class="pos">${fmtMoney(inc)}</span> &middot; Expenses <span class="neg">${fmtMoney(exp)}</span> &middot;
        Net <span class="${net>=0?'pos':'neg'}">${fmtMoney(net)}</span></div>`;
  }
  return `<label style="margin-top:0">Show records for</label><select class="lf-select">${opts}</select>${extra}`;
}

function renderLotFilters(){
  if (state.lotFilter && state.lotFilter !== 'none' && !selectedLot()){ state.lotFilter = ''; state.fromMaturity = false; }
  document.querySelectorAll('[data-lot-filter]').forEach(box => {
    box.style.display = state.lots.length ? '' : 'none';
    box.innerHTML = lotFilterHtml();
  });
}
document.addEventListener('change', e => {
  if (e.target.classList && e.target.classList.contains('lf-select')){
    state.lotFilter = e.target.value; state.fromMaturity = false;
    renderTx(); renderDebts(); renderTxHistory(); renderDebtHistory(); renderLotFilters();
  } else if (e.target.classList && e.target.classList.contains('lf-mature')){
    state.fromMaturity = e.target.checked;
    renderTx(); renderDebts(); renderTxHistory(); renderDebtHistory(); renderLotFilters();
  }
});

// ---------------- performance ----------------
const PERF_COLORS = ['#3d5c31','#b9832f','#a34a2f','#4f7a3d','#d4a24c','#7a5417','#5c5644','#8aa37a'];

function lotBreakdown(lot, metric){
  // metric: 'income' | 'expense'  ->  [{label, value}] grouped by category,
  // with credit (debt) amounts grouped as "On credit". Debt-settlement cash
  // entries are skipped, same double-counting rule as computeLotFinances.
  const map = {};
  state.tx.filter(t => t.lot_id === lot.id && t.type === metric && t.category !== 'Debt settlement')
    .forEach(t => { map[t.category || 'Other'] = (map[t.category || 'Other'] || 0) + t.amount; });
  const dir = metric === 'income' ? 'owed_to_me' : 'i_owe';
  const credit = state.debts.filter(d => d.lot_id === lot.id && d.direction === dir).reduce((s,d)=>s+d.amount,0);
  if (credit) map['On credit'] = (map['On credit'] || 0) + credit;
  return Object.entries(map).map(([label,value]) => ({label, value})).sort((a,b)=>b.value-a.value);
}

function perfStatsFor(lots){
  let inc=0, exp=0, sold=0, qty=0, lost=0;
  lots.forEach(l => { const f = computeLotFinances(l); inc+=f.income; exp+=f.expense; sold+=f.piecesSold; qty+=(l.quantity||0); lost+=totalLost(l); });
  const stats = [
    { label:'Income', value: fmtMoney(inc), cls:'pos' },
    { label:'Expenses', value: fmtMoney(exp), cls:'neg' },
    { label:'Net', value: fmtMoney(inc-exp), cls: inc-exp>=0?'pos':'neg' }
  ];
  if (qty > 0) stats.push({ label:'Mortality', value: (lost/qty*100).toFixed(1)+'%', cls: lost? 'neg':'' });
  if (sold > 0) stats.push({ label:'Avg price / bird', value: fmtMoney(inc/sold), cls:'' });
  if (qty > 0) stats.push({ label:'Cost / bird started', value: fmtMoney(exp/qty), cls:'' });
  return stats;
}

function barChartSvg(groups, seriesDefs){
  // groups: [{label, values:[...]}], seriesDefs: [{name,color}]
  const n = groups.length, sN = Math.max(...groups.map(g => g.values.length));
  const groupW = Math.max(70, sN*26 + 22), padL = 8, padR = 8, top = 16, plotH = 170, labelH = 44;
  const W = padL + padR + groupW*n, H = top + plotH + labelH;
  const all = groups.flatMap(g => g.values);
  const maxV = Math.max(0, ...all), minV = Math.min(0, ...all);
  const range = (maxV - minV) || 1;
  const y = v => top + (maxV - v) / range * plotH;
  const zeroY = y(0);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Bar graph" style="min-width:${Math.min(W,520)}px">`;
  s += `<line x1="${padL}" x2="${W-padR}" y1="${zeroY}" y2="${zeroY}" stroke="#d8cba8" stroke-width="1"/>`;
  groups.forEach((g, gi) => {
    const gx = padL + gi*groupW + (groupW - g.values.length*26 + 6)/2;
    g.values.forEach((v, si) => {
      const x = gx + si*26, yy = y(v), h = Math.max(1, Math.abs(yy - zeroY));
      s += `<rect x="${x}" y="${v>=0? yy : zeroY}" width="20" height="${h}" rx="3" fill="${(g.colors && g.colors[si]) || seriesDefs[si].color}"/>`;
      s += `<text x="${x+10}" y="${v>=0? yy-4 : zeroY+h+11}" text-anchor="middle" font-size="9" fill="#5c5644">${compactNum(v)}</text>`;
    });
    const lbl = g.label.length > 11 ? g.label.slice(0,10)+'…' : g.label;
    s += `<text x="${padL + gi*groupW + groupW/2}" y="${top+plotH+22}" text-anchor="middle" font-size="11" font-weight="600" fill="#2a2517">${escapeHtml(lbl)}</text>`;
  });
  return s + '</svg>';
}
function compactNum(v){
  const a = Math.abs(v), sign = v<0?'-':'';
  if (a >= 1e6) return sign + (a/1e6).toFixed(1) + 'M';
  if (a >= 1e3) return sign + (a/1e3).toFixed(a>=1e4?0:1) + 'k';
  return sign + Math.round(a);
}

function pieChartSvg(slices){
  const total = slices.reduce((s,x)=>s+x.value,0);
  const R = 90, cx = 110, cy = 110;
  let s = `<svg viewBox="0 0 220 220" role="img" aria-label="Pie chart" style="max-width:260px">`;
  if (slices.length === 1){
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${slices[0].color}"/>`;
  } else {
    let a0 = -Math.PI/2;
    slices.forEach(sl => {
      const a1 = a0 + sl.value/total * Math.PI*2;
      const x0 = cx + R*Math.cos(a0), y0 = cy + R*Math.sin(a0), x1 = cx + R*Math.cos(a1), y1 = cy + R*Math.sin(a1);
      s += `<path d="M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${a1-a0>Math.PI?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${sl.color}" stroke="#fbf8ef" stroke-width="2"/>`;
      a0 = a1;
    });
  }
  return s + '</svg>';
}

function renderPerfScope(){
  const sel = document.getElementById('perfScope'); if (!sel) return;
  const cur = state.perf.scope;
  sel.innerHTML = '<option value="all">All lots (compare)</option>'
    + state.lots.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  if (cur !== 'all' && !state.lots.some(l => String(l.id) === String(cur))) state.perf.scope = 'all';
  sel.value = state.perf.scope;
}

function renderPerformance(){
  const card = document.getElementById('perfCard'); if (!card) return;
  card.style.display = state.lots.length ? '' : 'none';
  if (!state.lots.length) return;
  renderPerfScope();
  const { scope, metric, chart } = state.perf;
  const lots = scope === 'all' ? state.lots : state.lots.filter(l => String(l.id) === String(scope));
  document.getElementById('perfStats').innerHTML = perfStatsFor(lots).map(s => `
    <div class="stat ${s.cls}"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`).join('');

  const chartEl = document.getElementById('perfChart'), legendEl = document.getElementById('perfLegend');
  const metricLabel = metric === 'income' ? 'Income' : 'Expenses';
  const noData = '<div class="empty">No income or expenses tagged to this yet. Pick the lot when you save a transaction or debt.</div>';

  if (chart === 'bar'){
    const series = [{name:'Income', color:'#3d5c31'}, {name:'Expenses', color:'#a34a2f'}, {name:'Net', color:'#b9832f'}];
    const groups = scope === 'all'
      ? lots.map(l => { const f = computeLotFinances(l); return { label:l.name, values:[f.income, f.expense, f.net] }; })
      : (() => { const f = computeLotFinances(lots[0]); return [
          { label:'Income', values:[f.income], colors:['#3d5c31'] },
          { label:'Expenses', values:[f.expense], colors:['#a34a2f'] },
          { label:'Net', values:[f.net], colors:[f.net>=0 ? '#b9832f' : '#7a2f18'] }]; })();
    if (groups.every(g => g.values.every(v => !v))){ chartEl.innerHTML = noData; legendEl.innerHTML = ''; return; }
    chartEl.innerHTML = barChartSvg(groups, series);
    legendEl.innerHTML = scope === 'all' ? series.map(s => `<div class="lg"><span class="sw" style="background:${s.color}"></span>${s.name}</div>`).join('') : '';
  } else {
    let slices = scope === 'all'
      ? lots.map(l => ({ label:l.name, value: Math.max(0, metric==='income' ? computeLotFinances(l).income : computeLotFinances(l).expense) }))
      : lotBreakdown(lots[0], metric);
    slices = slices.filter(s => s.value > 0).map((s,i) => ({ ...s, color: PERF_COLORS[i % PERF_COLORS.length] }));
    if (!slices.length){ chartEl.innerHTML = noData; legendEl.innerHTML = ''; return; }
    const total = slices.reduce((s,x)=>s+x.value,0);
    chartEl.innerHTML = pieChartSvg(slices);
    legendEl.innerHTML = `<div class="lg" style="font-weight:700;">${metricLabel}${scope==='all'?' share by lot':' by category'} &middot; total ${fmtMoney(total)}</div>`
      + slices.map(s => `<div class="lg"><span class="sw" style="background:${s.color}"></span>${escapeHtml(s.label)}
        <span class="lg-v">${fmtMoney(s.value)} &middot; ${(s.value/total*100).toFixed(0)}%</span></div>`).join('');
  }
}

document.getElementById('perfScope').addEventListener('change', e => { state.perf.scope = e.target.value; renderPerformance(); });
document.getElementById('perfMetric').addEventListener('change', e => { state.perf.metric = e.target.value; renderPerformance(); });
document.querySelectorAll('#perfChartSeg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#perfChartSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.perf.chart = b.dataset.val;
  document.getElementById('perfMetric').parentElement.style.display = state.perf.chart === 'pie' ? '' : 'none';
  renderPerformance();
}));
document.getElementById('perfMetric').parentElement.style.display = 'none';
