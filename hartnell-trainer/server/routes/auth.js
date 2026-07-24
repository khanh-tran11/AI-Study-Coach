const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// Demo users — replace with real DB lookup + bcrypt in production
const USERS = [
  { id: '1', name: 'Admin Owner',        email: 'admin@hartnell.edu',     password: 'admin123',   role: 'admin' },
  { id: '2', name: 'Dr. Maria Santos',   email: 'm.santos@hartnell.edu',  password: 'faculty123', role: 'faculty' },
  { id: '3', name: 'Prof. James Okafor', email: 'j.okafor@hartnell.edu',  password: 'faculty123', role: 'faculty' },
  { id: '4', name: 'Dr. Linda Cheng',    email: 'l.cheng@hartnell.edu',   password: 'faculty123', role: 'faculty' },
  { id: '5', name: 'Prof. Ahmed Yusuf',  email: 'a.yusuf@hartnell.edu',   password: 'faculty123', role: 'faculty' },
];

// API Gateway base URL — same endpoint Amir's progress Lambdas are deployed under
const AWS_API_BASE = process.env.AWS_API_BASE || 'https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com';

/**
 * Fire-and-forget login event to the DynamoDB login Lambda.
 * Initialises / refreshes all 10 module rows for this user so the
 * manager dashboard sees firstLoginAt and lastActiveAt immediately.
 * We never await this — a failure here should never block the login response.
 */
function recordLoginEvent(user) {
  axios
    .post(`${AWS_API_BASE}/api/auth/login`, {
      userId: user.id,
      name:   user.name,
      email:  user.email,
    })
    .catch(err => {
      // Non-fatal — log and move on
      console.warn('[auth] login-event record failed:', err.message);
    });
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = USERS.find(
    u => u.email.toLowerCase() === email?.toLowerCase() && u.password === password
  );

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  // Record the login event asynchronously — don't block the response
  recordLoginEvent(user);

  const { password: _, ...safe } = user;
  res.json({ user: safe });
});

router.post('/logout', (_req, res) => res.json({ success: true }));

module.exports = router;
