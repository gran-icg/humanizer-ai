
require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const COOKIE_NAME = 'dh.auth';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function sign(value) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(value)
    .digest('hex');
}

function getCookies(req) {
  const cookies = {};
  for (const item of (req.headers.cookie || '').split(';')) {
    const index = item.indexOf('=');
    if (index > -1) {
      cookies[item.slice(0, index).trim()] =
        item.slice(index + 1).trim();
    }
  }
  return cookies;
}

function isAuthenticated(req) {
  const token = getCookies(req)[COOKIE_NAME];
  if (!token || !process.env.SESSION_SECRET) return false;

  const index = token.lastIndexOf('.');
  if (index === -1) return false;

  const payload = token.slice(0, index);
  const signature = token.slice(index + 1);

  if (!safeEqual(signature, sign(payload))) return false;

  const expires = Number(payload);
  return Number.isSafeInteger(expires) && expires > Date.now();
}

function setAuthCookie(res) {
  const expires = String(Date.now() + SESSION_DURATION);
  const token = `${expires}.${sign(expires)}`;

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' ||
      !!process.env.NETLIFY,
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' ||
      !!process.env.NETLIFY,
    sameSite: 'lax',
    path: '/'
  });
}

// Static files for local development
app.use(express.static(path.join(__dirname, 'public'), {
  index: false
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Session status
app.get('/api/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (
    !process.env.LOGIN_USERNAME ||
    !process.env.LOGIN_PASSWORD ||
    !process.env.SESSION_SECRET
  ) {
    return res.status(503).json({
      error: 'Authentication is not configured.'
    });
  }

  if (
    !safeEqual(username ?? '', process.env.LOGIN_USERNAME) ||
    !safeEqual(password ?? '', process.env.LOGIN_PASSWORD)
  ) {
    return res.status(401).json({
      error: 'Incorrect username or password.'
    });
  }

  setAuthCookie(res);
  res.json({ ok: true });
});

// Logout
app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Humanize API
app.post('/api/humanize', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      error: 'Please sign in again.'
    });
  }

  const text = req.body?.text;

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      error: 'Enter text to humanize.'
    });
  }

  if (text.length > 100000) {
    return res.status(413).json({
      error: 'Maximum 100,000 characters allowed.'
    });
  }

  if (!process.env.GPTHUMAN_API_TOKEN) {
    return res.status(503).json({
      error: 'GPT Humanize API token is not configured.'
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      25000
    );

    let response;

    try {
      response = await fetch(
        'https://api.gpthuman.ai/v1/humanize',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${process.env.GPTHUMAN_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(
        response.status >= 500 ? 502 : response.status
      ).json({
        error: data.description ||
          data.error ||
          data.message ||
          'Humanization failed.'
      });
    }

    if (typeof data.output !== 'string') {
      return res.status(502).json({
        error: 'Invalid API response.'
      });
    }

    res.json({
      output: data.output,
      language: data.language,
      readability: data.readability,
      humanScore: data.humanScore,
      creditBalance: data.creditBalance,
      outputWordCount: data.outputWordCount
    });

  } catch (error) {
    res.status(502).json({
      error: error.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : 'Could not connect to GPT Humanize.'
    });
  }
});

// Run server only for local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
