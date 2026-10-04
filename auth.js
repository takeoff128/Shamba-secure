const jwt = require('jsonwebtoken');
const db = require('./db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to your .env file before starting the server.');
}

const COOKIE_NAME = 'shamba_session';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, payload) {
  const token = signToken(payload);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  try {
    const payload = jwt.verify(token, SECRET);
    // The JWT itself never expires early, so a removed user's old token would
    // otherwise keep working for up to 30 days. Check they still exist.
    const user = db.prepare('SELECT id, farm_id, role FROM users WHERE id = ?').get(payload.userId);
    if (!user || user.farm_id !== payload.farmId) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Your access has been removed. Please contact the farm owner.' });
    }
    req.user = { ...payload, role: user.role }; // role re-checked fresh in case it changed
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Log in again.' });
  }
}

function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: "Only the farm owner can do this." });
  }
  next();
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireOwner, COOKIE_NAME };
