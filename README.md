# Deutsche Humanize Studio

A responsive login-protected GPT Humanize text editor. Built with HTML, CSS, vanilla JavaScript, and a minimal Node.js/Express backend. No database needed.

## Requirements
- Node.js 18 or newer
- GPT Humanize API bearer token

## Start
1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `GPTHUMAN_API_TOKEN` to your real GPT Humanize token.
4. Set `SESSION_SECRET` to a long random secret (for example generate one using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Login
Default username: `Detsche`
Default password: `Deutsche@2026#`

Credentials can be overridden with `LOGIN_USERNAME` and `LOGIN_PASSWORD` in `.env`. They are checked server-side and are not exposed in frontend code. For public deployment, change the default password and set `NODE_ENV=production` behind HTTPS.

## Security / production
The API token remains server-side. Login sessions are stored in memory by default, which is suitable for a small single-instance demo, not a multi-instance production deployment. A production deployment should use a durable session store and HTTPS, set a unique login password and session secret, and configure proxy trust appropriately for secure cookies. This project does not persist submitted text or generated results. The third-party GPT Humanize API receives submitted text for processing.
