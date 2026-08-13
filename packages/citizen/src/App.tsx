import React, { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { fetchInterceptor } from './mocks/interceptor';
import { useAuthStore } from './stores/authStore';
import HomePage from './pages/home/HomePage';
import TravelPlanPage from './pages/travel/TravelPlanPage';
import RouteResultPage from './pages/travel/RouteResultPage';
import ParkingPage from './pages/parking/ParkingPage';
import ReportPage from './pages/report/ReportPage';
import ReportFormPage from './pages/report/ReportFormPage';
import ReportDetailPage from './pages/report/ReportDetailPage';
import ReportQueryPage from './pages/report/ReportQueryPage';
import NewsListPage from './pages/news/NewsListPage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import ServicesPage from './pages/services/ServicesPage';
import CarbonPage from './pages/carbon/CarbonPage';
import ProfilePage from './pages/profile/ProfilePage';
import MyReportsPage from './pages/profile/MyReportsPage';
import SettingsPage from './pages/profile/SettingsPage';
import AccountManagementPage from './pages/profile/AccountManagementPage';
import ElderlyHomePage from './pages/elderly/ElderlyHomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import QRCodePage from './pages/qrcode/QRCodePage';
import ChargingScanPage from './pages/charging/ChargingScanPage';
import MoveCarPage from './pages/movecar/MoveCarPage';
import BusDetailPage from './pages/bus/BusDetailPage';
import CustomBusPage from './pages/custombus/CustomBusPage';
import MetroDetailPage from './pages/metro/MetroDetailPage';

// 长辈模式 Context
interface ElderlyContextType {
  elderlyMode: boolean;
  toggleElderlyMode: () => void;
}
export const ElderlyContext = createContext<ElderlyContextType>({
  elderlyMode: false,
  toggleElderlyMode: () => {},
});
export const useElderly = () => useContext(ElderlyContext);

// 初始化 Mock 拦截器
if (import.meta.env.VITE_ENABLE_MOCK === 'true') {
  fetchInterceptor();
}

/** 需要登录才能访问的页面 */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuthStore();
  const location = useLocation();
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [elderlyMode, setElderlyMode] = useState(() => {
    return localStorage.getItem('zhitu_elder_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('zhitu_elder_mode', String(elderlyMode));
    if (elderlyMode) {
      document.documentElement.setAttribute('data-elderly', 'true');
    } else {
      document.documentElement.removeAttribute('data-elderly');
    }
  }, [elderlyMode]);

  const location = useLocation();
  const isFullScreen = location.pathname.startsWith('/elderly');
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <ElderlyContext.Provider
      value={{ elderlyMode, toggleElderlyMode: () => setElderlyMode(v => !v) }}
    >
      {isFullScreen ? (
        <Routes>
          <Route path="/elderly" element={<ElderlyHomePage />} />
        </Routes>
      ) : isAuthPage ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      ) : (
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/travel" element={<TravelPlanPage />} />
            <Route path="/travel/result" element={<RouteResultPage />} />
            <Route path="/parking" element={<ParkingPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/report/new" element={
              <RequireAuth><ReportFormPage /></RequireAuth>
            } />
            <Route path="/report/detail/:id" element={<ReportDetailPage />} />
            <Route path="/report/query" element={<ReportQueryPage />} />
            <Route path="/news" element={<NewsListPage />} />
            <Route path="/news/:id" element={<NewsDetailPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/carbon" element={<CarbonPage />} />
            <Route path="/qrcode" element={<QRCodePage />} />
            <Route path="/charging/scan" element={<ChargingScanPage />} />
            <Route path="/move-car" element={<MoveCarPage />} />
            <Route path="/travel/bus/:lineId" element={<BusDetailPage />} />
            <Route path="/travel/metro/:lineId" element={<MetroDetailPage />} />
            <Route path="/travel/custom-bus" element={<CustomBusPage />} />
            <Route path="/profile" element={
              <RequireAuth><ProfilePage /></RequireAuth>
            } />
            <Route path="/profile/reports" element={
              <RequireAuth><MyReportsPage /></RequireAuth>
            } />
            <Route path="/profile/settings" element={
              <RequireAuth><SettingsPage /></RequireAuth>
            } />
            <Route path="/profile/account" element={
              <RequireAuth><AccountManagementPage /></RequireAuth>
            } />
            <Route path="/profile/account/password" element={
              <RequireAuth><AccountManagementPage mode="password" /></RequireAuth>
            } />
          </Routes>
        </MainLayout>
      )}
    </ElderlyContext.Provider>
  );
};

export default App;
