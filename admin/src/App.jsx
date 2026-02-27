import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Sites = lazy(() => import('./pages/Sites.jsx'));
const CampaignBuilder = lazy(() => import('./pages/CampaignBuilder.jsx'));
const Campaigns = lazy(() => import('./pages/Campaigns.jsx'));
const Subscribers = lazy(() => import('./pages/Subscribers.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Webhooks = lazy(() => import('./pages/Webhooks.jsx'));

function isLoggedIn() {
  return !!localStorage.getItem('pp_token');
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="spinner" style={{ marginTop: 120 }} />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="sites" element={<Sites />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<CampaignBuilder />} />
            <Route path="campaigns/:id/edit" element={<CampaignBuilder />} />
            <Route path="subscribers" element={<Subscribers />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="webhooks" element={<Webhooks />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
