const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// Real DynamoDB-backed progress tracking via our AWS Lambda + API Gateway.
// Replaces the previous in-memory store. Response shape is unchanged —
// the Lambda was built to match this route's exact contract, so no
// transformation is needed on either side.
// See AI-Study-Coach backend/progress/ and backend/README.md for the
// Lambda implementation and DynamoDB schema.
const PROGRESS_API_BASE = 'https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com';

/**
 * POST /api/progress/update
 * Body: { userId, moduleId, stepId, status: 'completed'|'in_progress', timeSpentSeconds }
 */
router.post('/update', async (req, res) => {
  try {
    const { data } = await axios.post(`${PROGRESS_API_BASE}/api/progress/update`, req.body);
    res.json(data);
  } catch (err) {
    console.error('Progress update failed:', err.message);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
});

/**
 * GET /api/progress/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const { data } = await axios.get(`${PROGRESS_API_BASE}/api/progress/${req.params.userId}`);
    res.json(data);
  } catch (err) {
    console.error('Progress fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch progress.' });
  }
});

module.exports = router;
