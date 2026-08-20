import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Spin } from 'antd';
import { isAdminLoggedIn } from '../stores/adminAuth';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const IncidentListPage = lazy(() => import('../pages/incidents/IncidentListPage'));
const IncidentDetailPage = lazy(() => import('../pages/incidents/IncidentDetailPage'));
const UserManagementPage = lazy(() => import('../pages/users/UserManagementPage'));
const CarbonManagementPage = lazy(() => import('../pages/carbon/CarbonManagementPage'));
const ContentManagementPage = lazy(() => import('../pages/content/ContentManagementPage'));
const AnalyticsPage = lazy(() => import('../pages/analytics/AnalyticsPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const AdminLoginPage = lazy(() => import('../pages/login/AdminLoginPage'));
// 信号控制 / 设备管理 / 仿真推演 / 工单处置（页面已实现，补挂路由）
const SignalsPage = lazy(() => import('../pages/signals/SignalsPage'));
const IntersectionDetailPage = lazy(() => import('../pages/signals/IntersectionDetailPage'));
const DeviceListPage = lazy(() => import('../pages/devices/DeviceListPage'));
const DeviceDetailPage = lazy(() => import('../pages/devices/DeviceDetailPage'));
const SimulationPage = lazy(() => import('../pages/simulation/SimulationPage'));
const WorkOrderListPage = lazy(() => import('../pages/workorders/WorkOrderListPage'));
const WorkOrderDetailPage = lazy(() => import('../pages/workorders/WorkOrderDetailPage'));
const AccessibilityManagePage = lazy(() => import('../pages/accessibility/AccessibilityManagePage'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
    <Spin size="large" />
  </div>
);

const RequireAdmin = ({ children }: { children: ReactNode }) => {
  return isAdminLoggedIn() ? <>{children}</> : <Navigate to="/admin/login" replace />;
};

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<RequireAdmin><DashboardLayout /></RequireAdmin>}>
          <Route index element={<DashboardPage />} />
          <Route path="incidents" element={<IncidentListPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="carbon" element={<CarbonManagementPage />} />
          <Route path="content" element={<ContentManagementPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="signals" element={<SignalsPage />} />
          <Route path="signals/:id" element={<IntersectionDetailPage />} />
          <Route path="devices" element={<DeviceListPage />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="workorders" element={<WorkOrderListPage />} />
          <Route path="workorders/:id" element={<WorkOrderDetailPage />} />
          <Route path="accessibility" element={<AccessibilityManagePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
