import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Spin } from 'antd';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const IncidentListPage = lazy(() => import('../pages/incidents/IncidentListPage'));
const IncidentDetailPage = lazy(() => import('../pages/incidents/IncidentDetailPage'));
const SignalsPage = lazy(() => import('../pages/signals/SignalsPage'));
const IntersectionDetailPage = lazy(() => import('../pages/signals/IntersectionDetailPage'));
const SimulationPage = lazy(() => import('../pages/simulation/SimulationPage'));
const DeviceListPage = lazy(() => import('../pages/devices/DeviceListPage'));
const DeviceDetailPage = lazy(() => import('../pages/devices/DeviceDetailPage'));
const WorkOrderListPage = lazy(() => import('../pages/workorders/WorkOrderListPage'));
const WorkOrderDetailPage = lazy(() => import('../pages/workorders/WorkOrderDetailPage'));
const AnalyticsPage = lazy(() => import('../pages/analytics/AnalyticsPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
    <Spin size="large" tip="加载中..." />
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
          <Route path="signals" element={<SignalsPage />} />
          <Route path="signals/:id" element={<IntersectionDetailPage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="devices" element={<DeviceListPage />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="workorders" element={<WorkOrderListPage />} />
          <Route path="workorders/:id" element={<WorkOrderDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
