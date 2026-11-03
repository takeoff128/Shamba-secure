// Password rules for new passwords (sign-up, password reset, adding a team
// member). Existing passwords keep working at login; the rules apply the
// next time a password is set.
//
//  1. 8 to 128 characters, with at least one lowercase letter, one capital
//     letter, one number and one symbol.
//  2. Not a known leaked/common password, including the usual disguises
//     ("P@ssw0rd!", "Qwerty123!", "Kenya@2024"): the password is lowercased,
//     common letter swaps are undone (@->a, 0->o, 3->e, $->s ...), digits and
//     symbols around it are stripped, and the core word is checked against a
//     built-in list of the most common leaked passwords and base words.
//  3. No keyboard runs or sequences as the core ("asdfgh", "abcdef", "aaaaaa").
//  4. Does not contain the person's name, phone number, email name or farm name.
//  5. Not found in the Have I Been Pwned breach database (k-anonymity: only the
//     first 5 characters of the password's SHA-1 hash leave the server). If the
//     service can't be reached the check is skipped, so sign-up never breaks.
//     Turn it off with PASSWORD_BREACH_CHECK=off.

const crypto = require('crypto');

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

// Most common leaked passwords (from public breach top lists) plus the base
// words people decorate with numbers and symbols. Kept lowercase and
// "de-leeted"; compared against the normalised core of the password.
const COMMON = new Set(`
123456 password 123456789 12345678 12345 qwerty 1234567 111111 1234567890 123123 abc123 1234 password1 iloveyou
1q2w3e4r 000000 qwerty123 zaq12wsx dragon sunshine princess letmein 654321 monkey 27653 1qaz2wsx 123321 qwertyuiop
superman asdfghjkl 666666 football baseball welcome admin administrator login master hello freedom whatever qazwsx
trustno1 starwars passw0rd p@ssword shadow michael jordan jennifer hunter killer charlie andrew michelle daniel
thomas jessica ashley bailey buster soccer hockey batman tigger summer winter spring autumn flower lovely
loveyou iloveu lovers love123 angel angels jesus jesus1 christ blessed blessing godisgood faith hope peace
computer internet google samsung iphone android nokia apple orange banana chocolate cookie secret secret123
changeme default guest user test test123 testing temp temp123 pass pass123 pass1234 mypass mypassword newpass
access access14 mustang ferrari porsche mercedes toyota nissan honda corolla matatu boda
kenya kenya123 nairobi mombasa kisumu nakuru eldoret thika nyeri kakamega machakos kericho meru embu kiambu
uganda tanzania africa jambo karibu asante habari rafiki mpenzi upendo mungu baraka amani imani neema rehema
shamba shambasecure farm farmer farming kuku ngombe mbuzi kondoo nguruwe maziwa mayai mahindi chai kahawa
mpesa safaricom airtel telkom equity kcb harambee uhuru madaraka jamhuri mashujaa
arsenal chelsea liverpool manchester manutd united barcelona realmadrid madrid juventus gormahia gor mahia afc leopards
mama papa baba mother father family children brother sister friend friends
qwe123 asd123 zxc123 qweasd qweasdzxc asdasd zxcvbn zxcvbnm asdfgh qwerty1 abcd1234 abc12345 a1b2c3 a1b2c3d4
aa123456 aa12345678 123qwe 123abc 1q2w3e 1q2w3e4r5t q1w2e3r4 q1w2e3r4t5 zaq1xsw2 1qazxsw2 qwer1234 asdf1234
iloveyou1 password12 password123 password1234 welcome1 welcome123 admin123 admin1234 root toor
monkey123 dragon123 sunshine1 princess1 football1 baseball1 superman1 batman1 letmein1 master123 hello123
`.trim().split(/\s+/));

// Keyboard rows/columns, number pad and the alphabet, for run detection.
const RUNS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'abcdefghijklmnopqrstuvwxyz', 'qazwsxedcrfvtgbyhnujmikolp', '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p'];

const LEET = { '@': 'a', '4': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '9': 'g', '#': 'h', '1': 'i', '!': 'i', '|': 'l', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't', '2': 'z' };

function deLeet(s) { return s.toLowerCase().replace(/[@48(369#1!|0$57+2]/g, ch => LEET[ch] || ch); }

// "P@ssw0rd!2024" -> "password"; "Kenya@2024" -> "kenya"
function cores(pw) {
  const lower = pw.toLowerCase();
  const out = new Set();
  // strip leading/trailing digits & symbols first, then undo leet in what is left
  const trimmed = lower.replace(/^[^a-z]+|[^a-z]+$/g, '');
  [lower, trimmed].forEach(s => {
    if (!s) return;
    out.add(s);
    out.add(deLeet(s));
    out.add(deLeet(s).replace(/[^a-z]/g, ''));
    out.add(s.replace(/[^a-z0-9]/g, ''));
  });
  // also the letters-only core of the original
  out.add(lower.replace(/[^a-z]/g, ''));
  return [...out].filter(Boolean);
}

function isRun(s) {
  if (s.length < 4) return false;
  if (/^(.)\1+$/.test(s)) return true;                         // aaaaaa, 111111
  if (/^(.{1,3})\1+$/.test(s)) return true;                    // abcabc, 121212
  const rev = s.split('').reverse().join('');
  return RUNS.some(r => r.includes(s) || r.includes(rev));
}

function personalParts(info) {
  const parts = [];
  const add = v => { if (v && String(v).trim()) parts.push(String(v).trim().toLowerCase()); };
  if (info) {
    String(info.name || '').split(/\s+/).forEach(add);
    add(info.farmName && String(info.farmName).replace(/\s+/g, ''));
    String(info.farmName || '').split(/\s+/).forEach(add);
    if (info.email) add(String(info.email).split('@')[0]);
    if (info.phone) {
      const d = String(info.phone).replace(/\D/g, '');
      add(d); add(d.slice(-9)); add(d.slice(-7)); add(d.slice(-6));
    }
  }
  return [...new Set(parts)].filter(p => p.length >= 4 && !/^(farm|shamba|the|and|family)$/.test(p));
}

// Fast, offline checks. Returns { ok, errors: [messages], checks: {...} }.
function checkPasswordRules(password, info) {
  const pw = typeof password === 'string' ? password : '';
  const checks = {
    length: pw.length >= MIN_LENGTH && pw.length <= MAX_LENGTH,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw)
  };
  const errors = [];
  if (pw.length > MAX_LENGTH) errors.push(`Password must be at most ${MAX_LENGTH} characters.`);
  if (!checks.length && pw.length <= MAX_LENGTH) errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  const missing = [];
  if (!checks.lower) missing.push('a lowercase letter');
  if (!checks.upper) missing.push('a capital letter');
  if (!checks.number) missing.push('a number');
  if (!checks.symbol) missing.push('a symbol (e.g. ! @ # ?)');
  if (missing.length) errors.push('Password needs ' + missing.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.');

  if (!errors.length) {
    const cs = cores(pw);
    if (cs.some(c => COMMON.has(c))) errors.push('That password is too common and appears in leaked password lists. Choose something less predictable.');
    else if (cs.some(c => isRun(c))) errors.push('Avoid keyboard patterns and sequences like "qwerty", "abcd" or "1234".');
    else {
      const lowPw = pw.toLowerCase(), dl = deLeet(pw);
      const hit = personalParts(info).find(p => lowPw.includes(p) || dl.includes(deLeet(p)));
      if (hit) errors.push("Don't use your name, phone number, email or farm name in your password.");
    }
    // a password that is just a common word + a year/number, e.g. "Mahindi2024!"
    const core = pw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
    if (!errors.length && core.length > 0 && core.length < 4) errors.push('Use a longer word or phrase, not mostly numbers and symbols.');
  }
  return { ok: errors.length === 0, errors, checks };
}

// Have I Been Pwned range API. Resolves to the breach count (0 = not found),
// or null when the check could not be done.
async function breachCount(password, { timeoutMs = 3000, fetchImpl } = {}) {
  if ((process.env.PASSWORD_BREACH_CHECK || 'on').toLowerCase() === 'off') return null;
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return null;
  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5), suffix = sha1.slice(5);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'ShambaSecure-password-check' },
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [suf, count] = line.trim().split(':');
      if (suf === suffix) return parseInt(count, 10) || 0;   // padding lines have count 0
    }
    return 0;
  } catch (e) {
    return null;
  } finally { clearTimeout(timer); }
}

// Full check used by the API. Returns null when the password is acceptable,
// otherwise the message to show the user.
async function passwordProblem(password, info, opts) {
  const r = checkPasswordRules(password, info);
  if (!r.ok) return r.errors[0];
  const n = await breachCount(password, opts);
  if (n && n > 0) return 'That password has appeared in a data breach, so attackers already know it. Please choose a different one.';
  return null;
}

module.exports = { checkPasswordRules, breachCount, passwordProblem, MIN_LENGTH, MAX_LENGTH, _internals: { cores, isRun, personalParts, COMMON } };
