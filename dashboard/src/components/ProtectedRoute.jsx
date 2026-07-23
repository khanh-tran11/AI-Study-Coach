import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { role } = useAuth();

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
