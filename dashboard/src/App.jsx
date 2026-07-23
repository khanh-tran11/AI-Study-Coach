import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProgressProvider } from './context/ProgressContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import LearnerDashboard from './pages/LearnerDashboard';
import EducatorDashboard from './pages/EducatorDashboard';

function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard/learner" element={<LearnerDashboard />} />
                <Route path="/dashboard/educator" element={<EducatorDashboard />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ProgressProvider>
    </AuthProvider>
  );
}

export default App;
