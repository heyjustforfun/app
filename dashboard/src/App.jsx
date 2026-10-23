import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AppContext';
import Shell from './components/Shell';
import { Loading } from './components/ui';
import { Login, Register } from './pages/auth/Auth';
import Dashboard from './pages/customer/Dashboard';
import Funds from './pages/customer/Funds';
import Transactions from './pages/customer/Transactions';
import Deposit from './pages/customer/Deposit';
import Withdraw from './pages/customer/Withdraw';
import Documents from './pages/customer/Documents';
import Referrals from './pages/customer/Referrals';
import Support from './pages/customer/Support';
import Profile from './pages/customer/Profile';
import DailyTasks from './pages/customer/DailyTasks';
import AdminHub from './pages/admin/AdminHub';
import Overview from './pages/admin/Overview';
import AdminTasks from './pages/admin/TaskManagement';
import AdminUsers from './pages/admin/Users';
import AdminDeposits from './pages/admin/Deposits';
import AdminWithdrawals from './pages/admin/Withdrawals';
import AdminKyc from './pages/admin/Kyc';
import AdminFunds from './pages/admin/Funds';
import AdminSupport from './pages/admin/Support';
import AdminDocuments from './pages/admin/Documents';
import AdminInquiries from './pages/admin/Inquiries';
import AdminAudit from './pages/admin/Audit';
import AdminSettings from './pages/admin/Settings';

function Guard({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const isStaff = user.role === 'admin' || user.role === 'agent';
  if (role === 'admin' && !isStaff) return <Navigate to="/" replace />;
  if (role === 'customer' && isStaff) return <Navigate to="/admin" replace />;
  return children;
}

/** Login/register pages. Once signed in, sends the user where they were heading. */
function GuestOnly({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Loading />;
  if (user) {
    let to = '/';
    if (user.role === 'admin' || user.role === 'agent') to = '/admin';
    else if (new URLSearchParams(location.search).get('fund')) to = '/funds';
    else if (location.state?.from) to = location.state.from;
    return <Navigate to={to} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route element={<Guard role="customer"><Shell role="customer" /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<DailyTasks />} />
        <Route path="packages" element={<Funds />} />
        <Route path="funds" element={<Navigate to="/packages" replace />} />
        <Route path="deposit" element={<Deposit />} />
        <Route path="withdraw" element={<Withdraw />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="support" element={<Support />} />
        <Route path="profile" element={<Profile />} />
        <Route path="transactions" element={<Navigate to="/" replace />} />
        <Route path="documents" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="admin" element={<Guard role="admin"><Shell role="admin" /></Guard>}>
        <Route element={<AdminHub />}>
          <Route index element={<Overview />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="deposits" element={<AdminDeposits />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="kyc" element={<AdminKyc />} />
          <Route path="funds" element={<Navigate to="/admin" replace />} />
          <Route path="documents" element={<AdminDocuments />} />
          <Route path="inquiries" element={<AdminInquiries />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="support" element={<AdminSupport />} />
        <Route path="profile" element={<Profile admin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
