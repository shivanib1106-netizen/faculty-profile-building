import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Loading from './components/Loading';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

import FacultyDashboard from './pages/FacultyDashboard';
import FacultyProfile from './pages/FacultyProfile';
import Qualifications from './pages/Qualifications';
import Experience from './pages/Experience';
import ActivityList from './pages/ActivityList';
import CategoryI from './pages/CategoryI';
import CategoryII from './pages/CategoryII';
import CategoryIII from './pages/CategoryIII';
import Documents from './pages/Documents';
import APIScore from './pages/APIScore';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import ChangePassword from './pages/ChangePassword';

import HODDashboard from './pages/HODDashboard';
import HODFacultyMembers from './pages/HODFacultyMembers';
import HODFacultyProfiles from './pages/HODFacultyProfiles';
import Verification from './pages/Verification';
import PendingApprovals from './pages/PendingApprovals';
import ApprovedActivities from './pages/ApprovedActivities';
import RejectedActivities from './pages/RejectedActivities';

import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import FacultyManagement from './pages/FacultyManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import AcademicYearManagement from './pages/AcademicYearManagement';
import ScoringRules from './pages/ScoringRules';
import ActivityCategories from './pages/ActivityCategories';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

const RoleHome = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading fullScreen message="Verifying your session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'hod') return <Navigate to="/hod/dashboard" replace />;
  return <Navigate to="/faculty/dashboard" replace />;
};

const guarded = (roles, element) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
);

export const App = () => (
  <ErrorBoundary>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<RoleHome />} />
      <Route path="/dashboard" element={<RoleHome />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/403" element={guarded(['faculty', 'hod', 'admin'], <Forbidden />)} />

      <Route path="/faculty/dashboard" element={guarded(['faculty'], <FacultyDashboard />)} />
      <Route path="/faculty/profile" element={guarded(['faculty'], <FacultyProfile />)} />
      <Route path="/faculty/qualifications" element={guarded(['faculty'], <Qualifications />)} />
      <Route path="/faculty/experience" element={guarded(['faculty'], <Experience />)} />
      <Route path="/faculty/activities" element={guarded(['faculty'], <ActivityList />)} />
      <Route path="/faculty/category-1" element={guarded(['faculty'], <CategoryI />)} />
      <Route path="/faculty/category-2" element={guarded(['faculty'], <CategoryII />)} />
      <Route path="/faculty/category-3" element={guarded(['faculty'], <CategoryIII />)} />
      <Route path="/faculty/documents" element={guarded(['faculty'], <Documents />)} />
      <Route path="/faculty/api-score" element={guarded(['faculty'], <APIScore />)} />
      <Route path="/faculty/reports" element={guarded(['faculty'], <Reports />)} />
      <Route path="/faculty/notifications" element={guarded(['faculty'], <Notifications />)} />
      <Route path="/faculty/change-password" element={guarded(['faculty'], <ChangePassword />)} />

      <Route path="/hod/dashboard" element={guarded(['hod'], <HODDashboard />)} />
      <Route path="/hod/faculty-members" element={guarded(['hod'], <HODFacultyMembers />)} />
      <Route path="/hod/faculty-profiles" element={guarded(['hod'], <HODFacultyProfiles />)} />
      <Route path="/hod/verification" element={guarded(['hod'], <Verification />)} />
      <Route path="/hod/pending-approvals" element={guarded(['hod'], <PendingApprovals />)} />
      <Route path="/hod/approved-activities" element={guarded(['hod'], <ApprovedActivities />)} />
      <Route path="/hod/rejected-activities" element={guarded(['hod'], <RejectedActivities />)} />
      <Route path="/hod/reports" element={guarded(['hod'], <Reports />)} />
      <Route path="/hod/notifications" element={guarded(['hod'], <Notifications />)} />

      <Route path="/admin/dashboard" element={guarded(['admin'], <AdminDashboard />)} />
      <Route path="/admin/users" element={guarded(['admin'], <UserManagement />)} />
      <Route path="/admin/faculty" element={guarded(['admin'], <FacultyManagement />)} />
      <Route path="/admin/departments" element={guarded(['admin'], <DepartmentManagement />)} />
      <Route path="/admin/academic-years" element={guarded(['admin'], <AcademicYearManagement />)} />
      <Route path="/admin/scoring-rules" element={guarded(['admin'], <ScoringRules />)} />
      <Route path="/admin/categories" element={guarded(['admin'], <ActivityCategories />)} />
      <Route path="/admin/reports" element={guarded(['admin'], <Reports />)} />
      <Route path="/admin/audit-logs" element={guarded(['admin'], <AuditLogs />)} />
      <Route path="/admin/settings" element={guarded(['admin'], <Settings />)} />
      <Route path="/admin/notifications" element={guarded(['admin'], <Notifications />)} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  </ErrorBoundary>
);

export default App;
