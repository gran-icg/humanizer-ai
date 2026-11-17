require('dotenv').config();
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
if (!process.env.SESSION_SECRET) { console.error('Set SESSION_SECRET in .env'); process.exit(1); }
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'dh.sid', secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
const safeEqual = (a,b) => { const x = crypto.createHash('sha256').update(String(a)).digest(); const y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x,y); };
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
app.get('/', (req,res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/api/session', (req,res) => res.json({ authenticated: !!req.session.authenticated }));
app.post('/api/login', loginLimiter, (req,res) => {
  const { username, password } = req.body || {};
  if (!safeEqual(username ?? '', process.env.LOGIN_USERNAME || 'Detsche') || !safeEqual(password ?? '', process.env.LOGIN_PASSWORD || 'Deutsche@2026#')) return res.status(401).json({ error: 'Incorrect username or password.' });
  req.session.regenerate(err => { if (err) return res.status(500).json({error:'Unable to create session.'}); req.session.authenticated = true; res.json({ok:true}); });
});
app.post('/api/logout', (req,res) => req.session.destroy(() => { res.clearCookie('dh.sid'); res.json({ok:true}); }));
app.post('/api/humanize', async (req,res) => {
  if (!req.session.authenticated) return res.status(401).json({error:'Please sign in again.'});
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({error:'Enter text to humanize.'});
  if (text.length > 100000) return res.status(413).json({error:'Text is too long. Maximum 100,000 characters.'});
  if (!process.env.GPTHUMAN_API_TOKEN) return res.status(503).json({error:'API token is not configured. Add GPTHUMAN_API_TOKEN to .env.'});
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    let response;
    try { response = await fetch('https://api.gpthuman.ai/v1/humanize', { method:'POST', headers:{Authorization:`Bearer ${process.env.GPTHUMAN_API_TOKEN}`, 'Content-Type':'application/json'}, body:JSON.stringify({text}), signal:controller.signal }); }
    finally { clearTimeout(timeout); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status >= 500 ? 502 : response.status).json({error:data.description || data.error || data.message || `Humanize API returned ${response.status}.`});
    if (typeof data.output !== 'string') return res.status(502).json({error:'The API response did not contain humanized text.'});
    res.json({output:data.output, language:data.language, readability:data.readability, humanScore:data.humanScore, creditBalance:data.creditBalance, outputWordCount:data.outputWordCount});
  } catch(err) { res.status(502).json({error:err.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Could not connect to GPT Humanize. Please try again.'}); }
});
app.listen(PORT, () => console.log(`Deutsche Humanize Studio: http://localhost:${PORT}`));
