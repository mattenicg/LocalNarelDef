const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db/postgres');
const env = require('../config/env');
const { createSession, hashToken, getSession, logoutSession, SESSION_MAX_AGE_MS } = require('./session.service.pg');

function makeToken() { return crypto.randomBytes(48).toString('base64url'); }
function cookieOptions() { return { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/', maxAge: SESSION_MAX_AGE_MS }; }
async function findUserByEmail(email) { const { rows } = await query('SELECT id, first_name, last_name, email, password_hash, role, created_at FROM profiles WHERE lower(email)=lower($1)', [email]); return rows[0] || null; }
async function registerUser({ first_name, last_name, email, password }) {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(`INSERT INTO profiles (first_name,last_name,email,password_hash) VALUES ($1,$2,$3,$4)
    RETURNING id, first_name, last_name, email, role, created_at`, [first_name, last_name, email.toLowerCase(), hash]);
  return rows[0];
}
async function loginUser(email, password, req, res) {
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return null;
  const session = await createSession(user.id, req.headers['user-agent'] || '', req.ip || req.socket.remoteAddress || '');
  res.cookie('nl_access_token', session.token, cookieOptions());
  res.cookie('nl_session_id', session.session.session_id, cookieOptions());
  return { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, created_at: user.created_at };
}
async function requestPasswordReset(email) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const raw = makeToken();
  await query('UPDATE profiles SET reset_token_hash=$1, reset_token_expires_at=now()+interval \'1 hour\' WHERE id=$2', [hashToken(raw), user.id]);
  return raw;
}
async function resetPassword(rawToken, password) {
  const hash = await bcrypt.hash(password, 12);
  const result = await query(`UPDATE profiles SET password_hash=$1, reset_token_hash=NULL, reset_token_expires_at=NULL, updated_at=now()
    WHERE reset_token_hash=$2 AND reset_token_expires_at > now() RETURNING id`, [hash, hashToken(rawToken)]);
  return result.rowCount > 0;
}
module.exports = { cookieOptions, findUserByEmail, registerUser, loginUser, requestPasswordReset, resetPassword, logoutSession, getSession };
