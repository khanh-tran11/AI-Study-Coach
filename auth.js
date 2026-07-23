/**
 * auth.js — Shared session & role management
 * All pages import this via <script src="auth.js"></script>
 */

const Auth = (() => {
  const SESSION_KEY = "ai_trainer_session";

  // Demo credentials — replace with real API calls when backend is ready
  const USERS = [
    { id: 1, name: "Admin Owner",       email: "admin@college.edu",    password: "admin123",   role: "admin" },
    { id: 2, name: "Dr. Maria Santos",  email: "m.santos@college.edu", password: "faculty123", role: "faculty" },
    { id: 3, name: "Prof. James Okafor",email: "j.okafor@college.edu", password: "faculty123", role: "faculty" },
    { id: 4, name: "Dr. Linda Cheng",   email: "l.cheng@college.edu",  password: "faculty123", role: "faculty" },
    { id: 5, name: "Prof. Ahmed Yusuf", email: "a.yusuf@college.edu",  password: "faculty123", role: "faculty" },
  ];

  function login(email, password) {
    const user = USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) return { success: false, message: "Invalid email or password." };
    const session = { id: user.id, name: user.name, email: user.email, role: user.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  }

  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function requireRole(role) {
    const session = getSession();
    if (!session) { window.location.href = "index.html"; return null; }
    if (role && session.role !== role) {
      // Wrong role — send to their correct page
      window.location.href = session.role === "admin" ? "admin-upload.html" : "user-training.html";
      return null;
    }
    return session;
  }

  return { login, logout, getSession, requireRole };
})();
