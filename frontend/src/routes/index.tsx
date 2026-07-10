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
const PokaYokeEntry = lazy(() => import('../pages/pokayoke/PokaYokeEntry').then(m => ({ default: m.PokaYokeEntry })));
const PokaYokeReports = lazy(() => import('../pages/pokayoke/PokaYokeReports').then(m => ({ default: m.PokaYokeReports })));
const PokaYokeApprovals = lazy(() => import('../pages/pokayoke/PokaYokeApprovals').then(m => ({ default: m.PokaYokeApprovals })));


// Global Page Loader
const PageLoader = () => (
  <Center h="100vh" w="100%">
    <Loader size="xl" type="dots" color="blue" />
  </Center>
);

// Auth Guard Component
const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles?: string[] }) => {
  const { token, user } = useAuthStore();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
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
          <Route path="/master-data" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}><MasterData /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}><Customers /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}><ExcelUpload /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><Settings /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><UserManagement /></ProtectedRoute>} />
          
          {/* Shared/Inspector Routes */}
          <Route path="/inspection" element={<ProtectedRoute><InspectionEntry /></ProtectedRoute>} />
          <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/reports/:id" element={<ProtectedRoute><ReportPreview /></ProtectedRoute>} />
          
          {/* Poka Yoke Routes */}
          <Route path="/pokayoke/entry" element={<ProtectedRoute><PokaYokeEntry /></ProtectedRoute>} />
          <Route path="/pokayoke/reports" element={<ProtectedRoute><PokaYokeReports /></ProtectedRoute>} />
          <Route path="/pokayoke/approvals" element={<ProtectedRoute><PokaYokeApprovals /></ProtectedRoute>} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

