const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// Proxies to Khanh's real Flask manager-side app (manager-side/app.py,
// run separately on :5001) — real DynamoDB-backed employee tracking and
// cheating-detection logic (AITrainerProgress table), not mocked.
//
// Flask uses session-cookie auth (@login_required). We log in once here
// and reuse the session cookie for all proxied calls, so the browser
// never talks to Flask directly (avoids CORS/cross-origin cookie issues).
const FLASK_BASE = 'http://localhost:5001';
const FLASK_USERNAME = 'admin';
const FLASK_PASSWORD = 'admin123';

let sessionCookie = null;

async function loginToFlask() {
  const resp = await axios.post(
    `${FLASK_BASE}/login`,
    new URLSearchParams({ username: FLASK_USERNAME, password: FLASK_PASSWORD }),
    { maxRedirects: 0, validateStatus: s => s === 302 || s === 200 }
  );
  const setCookie = resp.headers['set-cookie'];
  if (!setCookie) throw new Error('Flask login did not return a session cookie');
  sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
}

async function proxyGet(flaskPath) {
  if (!sessionCookie) await loginToFlask();
  try {
    return await axios.get(`${FLASK_BASE}${flaskPath}`, { headers: { Cookie: sessionCookie } });
  } catch (err) {
    if (err.response?.status === 302 || err.response?.status === 401) {
      // Session expired/invalid - log in again and retry once
      await loginToFlask();
      return axios.get(`${FLASK_BASE}${flaskPath}`, { headers: { Cookie: sessionCookie } });
    }
    throw err;
  }
}

/** GET /api/manager/employees - real per-module records from AITrainerProgress */
router.get('/employees', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/employees');
    res.json(data);
  } catch (err) {
    console.error('Manager employees fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch employee data. Is manager-side/app.py running on :5001?' });
  }
});

/** GET /api/manager/analytics - real avg time per module */
router.get('/analytics', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/analytics');
    res.json(data);
  } catch (err) {
    console.error('Manager analytics fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics. Is manager-side/app.py running on :5001?' });
  }
});

/** GET /api/manager/alerts - real cheating-detection warnings/reports */
router.get('/alerts', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/alerts');
    res.json(data);
  } catch (err) {
    console.error('Manager alerts fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts. Is manager-side/app.py running on :5001?' });
  }
});

module.exports = router;
