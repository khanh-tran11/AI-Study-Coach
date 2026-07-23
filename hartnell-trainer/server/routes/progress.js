const express = require('express');
const router  = express.Router();

// In-memory store — swap for a real DB (Postgres/DynamoDB) in production
const progressStore = {};

/**
 * POST /api/progress/update
 * Body: { userId, moduleId, stepId, status: 'completed'|'in_progress', timeSpentSeconds }
 */
router.post('/update', (req, res) => {
  const { userId, moduleId, stepId, status, timeSpentSeconds = 0 } = req.body;
  if (!userId || !moduleId || !stepId) {
    return res.status(400).json({ error: 'userId, moduleId, and stepId are required.' });
  }

  if (!progressStore[userId]) progressStore[userId] = { modules: {}, totalSeconds: 0 };
  const user = progressStore[userId];

  if (!user.modules[moduleId]) user.modules[moduleId] = { steps: {}, completedAt: null };
  const mod = user.modules[moduleId];

  mod.steps[stepId] = { status, updatedAt: new Date().toISOString() };
  user.totalSeconds += timeSpentSeconds;

  // Mark module complete when all steps in the lesson are done
  const stepStatuses = Object.values(mod.steps);
  if (status === 'completed' && stepStatuses.every(s => s.status === 'completed')) {
    mod.completedAt = new Date().toISOString();
  }

  res.json({ success: true, progress: getUserStats(userId) });
});

/**
 * GET /api/progress/:userId
 */
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  if (!progressStore[userId]) return res.json(getEmptyStats(userId));
  res.json(getUserStats(userId));
});

function getUserStats(userId) {
  const data = progressStore[userId];
  if (!data) return getEmptyStats(userId);
  const completedModules = Object.values(data.modules).filter(m => m.completedAt).length;
  const totalModules = 10;
  return {
    userId,
    completedModules,
    totalModules,
    completionPct: Math.round((completedModules / totalModules) * 100),
    totalHours: +(data.totalSeconds / 3600).toFixed(1),
    modules: data.modules,
    escalationStatus: completionPct => completionPct >= 100 ? 'certified' : completionPct >= 50 ? 'on_track' : 'needs_attention',
  };
}

function getEmptyStats(userId) {
  return { userId, completedModules: 0, totalModules: 10, completionPct: 0, totalHours: 0, modules: {} };
}

module.exports = router;
