const crypto = require('crypto');
const { query } = require('../db/postgres');
const env = require('../config/env');
const MS_PER_DAY = 86400000;
const SESSION_MAX_AGE_MS = (env.SESSION_COOKIE_MAX_AGE_DAYS || 7) * MS_PER_DAY;
function generateSessionId() { return `sess_${crypto.randomBytes(32).toString('hex')}`; }
function hashToken(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
async function createSession(userId, userAgent = '', ip = '') {
  const token = crypto.randomBytes(48).toString('base64url');
  const sessionId = generateSessionId();
  await query('UPDATE user_sessions SET active=false, invalidated_at=now() WHERE user_id=$1 AND active=true', [userId]);
  const { rows } = await query(`INSERT INTO user_sessions(user_id,session_id,token_hash,user_agent,ip_address)
    VALUES($1,$2,$3,$4,$5) RETURNING id,session_id,user_id,active,created_at,last_seen`, [userId, sessionId, hashToken(token), String(userAgent).slice(0,500) || null, ip || null]);
  return { ok: true, token, session: rows[0] };
}
async function getSession(token, sessionId) {
  if (!token || !sessionId) return null;
  const { rows } = await query(`SELECT s.*,p.id AS profile_id,p.first_name,p.last_name,p.email,p.role,p.created_at AS profile_created_at
    FROM user_sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=$1 AND s.session_id=$2 AND s.active=true`, [hashToken(token), sessionId]);
  return rows[0] || null;
}
async function validateSession(userId, sessionId, token) {
  const session = await getSession(token, sessionId);
  if (!session || String(session.user_id) !== String(userId)) return { ok: false, message: 'Sesión inválida' };
  if (Date.now() - new Date(session.last_seen).getTime() > SESSION_MAX_AGE_MS) { await logoutSession(sessionId); return { ok: false, message: 'Sesión expirada' }; }
  return { ok: true, session };
}
async function touchSession(sessionId) { if (sessionId) await query(`UPDATE user_sessions SET last_seen=now() WHERE session_id=$1 AND active=true AND last_seen < now()-interval '3 minutes'`, [sessionId]); }
async function logoutSession(sessionId) { if (sessionId) await query('UPDATE user_sessions SET active=false,invalidated_at=now() WHERE session_id=$1', [sessionId]); return { ok: true }; }
function extractSessionCookie(req) { return req?.cookies?.nl_session_id || req?.headers?.['x-session-id'] || null; }
module.exports = { generateSessionId, hashToken, createSession, getSession, validateSession, touchSession, logoutSession, extractSessionCookie, SESSION_MAX_AGE_MS, MS_PER_DAY };
