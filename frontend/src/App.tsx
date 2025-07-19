import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import EmailVerification from "./pages/EmailVerification";
import Welcome from "./pages/Welcome";
import UpcomingEvents from "./pages/UpcomingEvents";
import PassedEvents from "./pages/PassedEvents";
import CreateEvent from "./pages/CreateEvent";
import Management from "./pages/Management";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import ChangePassword from "./pages/ChangePassword";
import SystemMessages from "./pages/SystemMessages";
import Analytics from "./pages/Analytics";
import DashboardLayout from "./layouts/DashboardLayout";
import EventDetail from "./pages/EventDetail";

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email/:token" element={<EmailVerification />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Welcome />} />
            <Route path="welcome" element={<Welcome />} />
            <Route path="upcoming" element={<UpcomingEvents />} />
            <Route path="passed" element={<PassedEvents />} />
            <Route
              path="new-event"
              element={
                <ProtectedRoute
                  allowedRoles={["Super Admin", "Administrator", "Leader"]}
                >
                  <CreateEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="management"
              element={
                <ProtectedRoute
                  allowedRoles={["Super Admin", "Administrator", "Leader"]}
                >
                  <Management />
                </ProtectedRoute>
              }
            />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:userId" element={<UserProfile />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="system-messages" element={<SystemMessages />} />
            <Route
              path="analytics"
              element={
                <ProtectedRoute
                  allowedRoles={["Super Admin", "Administrator", "Leader"]}
                >
                  <Analytics />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route
            path="/dashboard/event/:id"
            element={
              <ProtectedRoute>
                <EventDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/logout" element={<Home />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
