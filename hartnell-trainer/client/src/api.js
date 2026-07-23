// Central API client — reads base URL from env var injected by Amplify.
// Locally: falls back to the Express dev server at :4000 via CRA proxy.
// On Amplify: REACT_APP_API_URL is set to the API Gateway prod stage URL.

import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL ?? '';  // '' → uses CRA proxy → :4000

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginUser   = (email, password)       => api.post('/api/auth/login',  { email, password });
export const logoutUser  = ()                       => api.post('/api/auth/logout', {});

// ── Training ──────────────────────────────────────────────────────────────────
export const fetchModule = (moduleId)               => api.get(`/api/training/${moduleId}`);

// ── Progress ──────────────────────────────────────────────────────────────────
export const fetchProgress  = (userId)              => api.get(`/api/progress/${userId}`);
export const updateProgress = (payload)             => api.post('/api/progress/update', payload);
// payload: { userId, moduleId, stepId, status, timeSpentSeconds }

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendChat = (messages, context)         => api.post('/api/chat', { messages, context });

export default api;
