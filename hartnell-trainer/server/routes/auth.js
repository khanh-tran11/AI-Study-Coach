const express = require('express');
const router  = express.Router();

// Demo users — replace with real DB lookup + bcrypt in production
const USERS = [
  { id: '1', name: 'Admin Owner',        email: 'admin@hartnell.edu',     password: 'admin123',   role: 'admin' },
  { id: '2', name: 'Dr. Maria Santos',   email: 'm.santos@hartnell.edu',  password: 'faculty123', role: 'faculty' },
  { id: '3', name: 'Prof. James Okafor', email: 'j.okafor@hartnell.edu',  password: 'faculty123', role: 'faculty' },
  { id: '4', name: 'Dr. Linda Cheng',    email: 'l.cheng@hartnell.edu',   password: 'faculty123', role: 'faculty' },
  { id: '5', name: 'Prof. Ahmed Yusuf',  email: 'a.yusuf@hartnell.edu',   password: 'faculty123', role: 'faculty' },
];

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = USERS.find(u => u.email.toLowerCase() === email?.toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const { password: _, ...safe } = user;
  res.json({ user: safe });
});

router.post('/logout', (_req, res) => res.json({ success: true }));

module.exports = router;
