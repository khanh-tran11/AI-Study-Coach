// Central API client.
// Locally: falls back to the Express dev server at :4000 via CRA proxy.
// On Amplify/prod: set REACT_APP_API_URL to the deployed API Gateway URL.
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL ?? '';  // '' → CRA proxy → :4000

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginUser  = (email, password) => api.post('/api/auth/login',  { email, password });
export const logoutUser = ()                => api.post('/api/auth/logout', {});

// ── Training ──────────────────────────────────────────────────────────────────
export const fetchModuleList = ()         => api.get('/api/training');
export const fetchModule     = (moduleId) => api.get(`/api/training/${moduleId}`);

// ── Progress ──────────────────────────────────────────────────────────────────
export const fetchProgress  = (userId)  => api.get(`/api/progress/${userId}`);
export const updateProgress = (payload) => api.post('/api/progress/update', payload);

// ── Chat ──────────────────────────────────────────────────────────────────────
// Calls the Panther Bedrock Knowledge Base via API Gateway directly
export const sendChat = async (messages, context) => {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUserMsg?.content || '';

  const res = await fetch('https://9alic6z3ej.execute-api.us-west-2.amazonaws.com/panther-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText }),
  });

  const data = await res.json();
  return { data: { reply: { role: 'assistant', content: data.answer || "I couldn't find an answer." } } };
};

// ── Upload pipeline ───────────────────────────────────────────────────────────
// Step 1a: get a presigned S3 PUT URL (AWS) or a local key (local-dev)
export const presignUpload = (filename) =>
  api.post('/api/upload/presign', { filename });

// Step 1b (local-dev only): POST the file as multipart to the Express server
export const uploadLocalFile = (formData, onProgress) =>
  api.post('/api/upload/local', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });

// Step 2: trigger AI module generation for a list of uploaded file keys
export const generateModules = (files, moduleTitle) =>
  api.post('/api/upload/generate', { files, moduleTitle });

// Step 3: list all AI-generated modules
export const fetchGeneratedModules = () => api.get('/api/upload/modules');

// Delete a single generated module by ID
export const deleteGeneratedModule = (id) => api.delete(`/api/upload/modules/${id}`);

// Clear all generated modules
export const clearGeneratedModules = () => api.delete('/api/upload/modules');

export default api;
