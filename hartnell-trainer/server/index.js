require('dotenv').config();
const express = require('express');
const cors = require('cors');

const trainingRoutes = require('./routes/training');
const progressRoutes = require('./routes/progress');
const chatRoutes     = require('./routes/chat');
const authRoutes     = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/training', trainingRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/auth',     authRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Hartnell AI Trainer' }));

app.listen(PORT, () => console.log(`Hartnell Trainer API running on :${PORT}`));
