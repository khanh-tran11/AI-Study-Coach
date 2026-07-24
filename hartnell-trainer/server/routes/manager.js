const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// Flask manager-side app – runs separately on :5001
// Credentials and base URL are read from environment variables.
// Add these to hartnell-trainer/.env:
//   FLASK_BASE_URL=http://localhost:5001
//   FLASK_USERNAME=admin
//   FLASK_PASSWORD=change_me
const FLASK_BASE     = process.env.FLASK_BASE_URL || 'http://localhost:5001';
const FLASK_USERNAME = process.env.FLASK_USERNAME;
const FLASK_PASSWORD = process.env.FLASK_PASSWORD;

if (!FLASK_USERNAME || !FLASK_PASSWORD) {
  console.warn(
    '[manager] FLASK_USERNAME or FLASK_PASSWORD not set in .env — ' +
    'manager proxy will fail at runtime.'
  );
}

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
    return await axios.get(`${FLASK_BASE}${flaskPath}`, {
      headers: { Cookie: sessionCookie },
    });
  } catch (err) {
    if (err.response?.status === 302 || err.response?.status === 401) {
      // Session expired — re-login once and retry
      await loginToFlask();
      return axios.get(`${FLASK_BASE}${flaskPath}`, {
        headers: { Cookie: sessionCookie },
      });
    }
    throw err;
  }
}

/** GET /api/manager/employees */
router.get('/employees', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/employees');
    res.json(data);
  } catch (err) {
    console.error('[manager] employees fetch failed:', err.message);
    res.status(500).json({
      error: 'Failed to fetch employee data. Is manager-side/app.py running on :5001?',
    });
  }
});

/** GET /api/manager/analytics */
router.get('/analytics', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/analytics');
    res.json(data);
  } catch (err) {
    console.error('[manager] analytics fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

/** GET /api/manager/alerts */
router.get('/alerts', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/alerts');
    res.json(data);
  } catch (err) {
    console.error('[manager] alerts fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

/** GET /api/manager/deadlines */
router.get('/deadlines', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/deadlines');
    res.json(data);
  } catch (err) {
    console.error('[manager] deadlines fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch deadlines.' });
  }
});

/** GET /api/manager/reports */
router.get('/reports', async (req, res) => {
  try {
    const { data } = await proxyGet('/manager/reports');
    res.json(data);
  } catch (err) {
    console.error('[manager] reports fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

module.exports = router;
