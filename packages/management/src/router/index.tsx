import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Spin } from 'antd';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const IncidentListPage = lazy(() => import('../pages/incidents/IncidentListPage'));
const IncidentDetailPage = lazy(() => import('../pages/incidents/IncidentDetailPage'));
const UserManagementPage = lazy(() => import('../pages/users/UserManagementPage'));
const CarbonManagementPage = lazy(() => import('../pages/carbon/CarbonManagementPage'));
const ContentManagementPage = lazy(() => import('../pages/content/ContentManagementPage'));
const AnalyticsPage = lazy(() => import('../pages/analytics/AnalyticsPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
    <Spin size="large" />
  </div>
);

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="incidents" element={<IncidentListPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="carbon" element={<CarbonManagementPage />} />
          <Route path="content" element={<ContentManagementPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
