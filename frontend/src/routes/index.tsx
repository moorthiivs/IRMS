import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { DashboardLayout } from '../layouts/DashboardLayout';

// Pages
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { InspectionEntry } from '../pages/InspectionEntry';
import { Reports } from '../pages/Reports';
import { ReportPreview } from '../pages/ReportPreview';
import { MasterData } from '../pages/MasterData';
import { ExcelUpload } from '../pages/ExcelUpload';
import { Settings } from '../pages/Settings';
import { UserManagement } from '../pages/UserManagement';
import { Drafts } from '../pages/Drafts';
import { NotFound } from '../pages/NotFound';

// Auth Guard Component
const ProtectedRoute = ({ children, requireAdmin = false }: { children: JSX.Element, requireAdmin?: boolean }) => {
  const { token, user } = useAuthStore();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

export function AppRoutes() {
  const { token, user } = useAuthStore();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          token && user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login />
          )
        } 
      />
      
      <Route element={<DashboardLayout />}>
        {/* Admin Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/master-data" element={<ProtectedRoute requireAdmin><MasterData /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute requireAdmin><ExcelUpload /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute requireAdmin><UserManagement /></ProtectedRoute>} />
        
        {/* Shared/Inspector Routes */}
        <Route path="/inspection" element={<ProtectedRoute><InspectionEntry /></ProtectedRoute>} />
        <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/reports/:id" element={<ProtectedRoute><ReportPreview /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

