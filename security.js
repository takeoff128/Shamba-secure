// Lightweight, dependency-free protections for the auth-sensitive endpoints.
// No new npm packages: a small in-memory rate limiter (fine for the
// single-process deployment this app is built for — see README "Deploying")
// plus a handful of standard security headers.

const buckets = new Map(); // key -> { count, resetAt }

// Keeps the map from growing forever as IPs/identifiers cycle through.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000);
if (typeof sweep.unref === 'function') sweep.unref();

// Caps how many times a window can be hit for a given key (default: per IP).
// Pass keyFn to also fold in something the request sent (e.g. the phone/email
// being logged into), so one shared office/NAT IP can't lock everyone else
// out of the farm's own account.
function rateLimit({ windowMs, max, keyFn, message }) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: message || 'Too many attempts. Please wait a few minutes and try again.' });
    }
    next();
  };
}

// A few headers that cost nothing and close off easy wins for an attacker:
// no MIME sniffing, no framing (clickjacking), no referrer leakage to other
// sites, no access to device sensors the app never uses.
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

module.exports = { rateLimit, securityHeaders };
