import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage    from './pages/LoginPage';
import TrainingPage from './pages/TrainingPage';
import AdminPage    from './pages/AdminPage';

// Role-based guard
function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user)             return <Navigate to="/"        replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/training'} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          user
            ? <Navigate to={user.role === 'admin' ? '/admin' : '/training'} replace />
            : <LoginPage />
        }
      />
      <Route
        path="/training"
        element={
          <RequireRole role="faculty">
            <TrainingPage />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminPage />
          </RequireRole>
        }
      />
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
