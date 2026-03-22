import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider } from './context/DataContext';
import MainLayout from './layouts/MainLayout';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { runDailyCronJobs } from './utils/cronService';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Investments = lazy(() => import('./pages/Investments'));
const Goals = lazy(() => import('./pages/Goals'));
const CreditCards = lazy(() => import('./pages/CreditCards'));
const Lending = lazy(() => import('./pages/Lending'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Accounts = lazy(() => import('./pages/Accounts'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated) {
      runDailyCronJobs();
    }
  }, [isAuthenticated]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="investments" element={<Investments />} />
          <Route path="goals" element={<Goals />} />
          <Route path="credit-cards" element={<CreditCards />} />
          <Route path="lending" element={<Lending />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <AppRoutes />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: { borderRadius: '12px', padding: '12px 20px', fontSize: '14px' },
                  success: { style: { background: '#10b981', color: '#fff' } },
                  error: { style: { background: '#ef4444', color: '#fff' } },
                }}
              />
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
