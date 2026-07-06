import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Loader, Center } from '@mantine/core';
import { OTAUpdater } from '../components/OTAUpdater';

// Lazy-loaded Pages
const Login = lazy(() => import('../pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const InspectionEntry = lazy(() => import('../pages/InspectionEntry').then(m => ({ default: m.InspectionEntry })));
const Reports = lazy(() => import('../pages/Reports').then(m => ({ default: m.Reports })));
const ReportPreview = lazy(() => import('../pages/ReportPreview').then(m => ({ default: m.ReportPreview })));
const MasterData = lazy(() => import('../pages/MasterData').then(m => ({ default: m.MasterData })));
const ExcelUpload = lazy(() => import('../pages/ExcelUpload').then(m => ({ default: m.ExcelUpload })));
const Settings = lazy(() => import('../pages/Settings').then(m => ({ default: m.Settings })));
const UserManagement = lazy(() => import('../pages/UserManagement').then(m => ({ default: m.UserManagement })));
const Drafts = lazy(() => import('../pages/Drafts').then(m => ({ default: m.Drafts })));
const Customers = lazy(() => import('../pages/Customers').then(m => ({ default: m.Customers })));
const NotFound = lazy(() => import('../pages/NotFound').then(m => ({ default: m.NotFound })));

// Global Page Loader
const PageLoader = () => (
  <Center h="100vh" w="100%">
    <Loader size="xl" type="dots" color="blue" />
  </Center>
);

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
    <Suspense fallback={<PageLoader />}>
      <OTAUpdater />
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
          <Route path="/customers" element={<ProtectedRoute requireAdmin><Customers /></ProtectedRoute>} />
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
    </Suspense>
  );
}

