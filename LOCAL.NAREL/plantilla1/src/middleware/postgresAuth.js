const { getSession, validateSession, touchSession, extractSessionCookie } = require('../services/session.service.pg');
const { query } = require('../db/postgres');
const env = require('../config/env');
const COOKIE_ACCESS = 'nl_access_token';
function extractAccessToken(req) { const auth = req.headers.authorization || ''; return auth.startsWith('Bearer ') ? auth.slice(7) : req.cookies?.[COOKIE_ACCESS] || null; }
function clearAuthCookies(res) { res.clearCookie(COOKIE_ACCESS, { httpOnly:true, sameSite:'lax', secure:env.NODE_ENV==='production', path:'/' }); res.clearCookie('nl_session_id', { httpOnly:true, sameSite:'lax', secure:env.NODE_ENV==='production', path:'/' }); }
async function authenticate(req,res,next) {
  try {
    const token = extractAccessToken(req); const sessionId = extractSessionCookie(req);
    const session = await getSession(token, sessionId);
    if (!session) { clearAuthCookies(res); return res.status(401).json({ok:false,error:'unauthenticated',message:'Autenticación requerida'}); }
    const valid = await validateSession(session.user_id, sessionId, token);
    if (!valid.ok) { clearAuthCookies(res); return res.status(401).json({ok:false,error:'session_invalid',message:valid.message}); }
    await touchSession(sessionId);
    req.authAccessToken = token; req.authSessionId = sessionId;
    req.user = { id: session.user_id, first_name: session.first_name, last_name: session.last_name, email: session.email, role: session.role, created_at: session.profile_created_at };
    next();
  } catch (error) { res.status(500).json({ok:false,error:'server_error',message:'Error interno'}); }
}
async function requireAdmin(req,res,next) {
  if (!req.user) return res.status(401).json({ok:false,message:'Autenticación requerida'});
  const { rows } = await query('SELECT role FROM profiles WHERE id=$1', [req.user.id]);
  if (rows[0]?.role !== 'admin') return res.status(403).json({ok:false,error:'forbidden_not_admin',message:'No tenés permisos para acceder a esta sección'});
  req.user.role = 'admin'; next();
}
async function publicOnlyRedirect(req,res,next) { if (extractAccessToken(req) && extractSessionCookie(req)) { const s=await getSession(extractAccessToken(req),extractSessionCookie(req)); if(s) return res.redirect(req.query.next || '/dashboard.html'); } next(); }
module.exports = { authenticate, requireAdmin, publicOnlyRedirect, extractAccessToken, clearAuthCookies, COOKIE_ACCESS };
