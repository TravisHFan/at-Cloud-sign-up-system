import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import RealTimeNotificationToast from "./components/notifications/RealTimeNotificationToast";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import EmailVerification from "./pages/EmailVerification";
import Welcome from "./pages/Welcome";
import UpcomingEvents from "./pages/UpcomingEvents";
import PassedEvents from "./pages/PassedEvents";
import NewEvent from "./pages/NewEvent";
import Management from "./pages/Management";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import ChangePassword from "./pages/ChangePassword";
import SystemMessages from "./pages/SystemMessages";
import Analytics from "./pages/Analytics";
import ChatPage from "./pages/ChatPage";
import DashboardLayout from "./layouts/DashboardLayout";
import EventDetail from "./pages/EventDetail";

// Import welcome message test utilities (development only) - CSP safe version
import "./utils/welcomeMessageTestUtils";

function App() {
  return (
    <AuthProvider>
      {/* Real-time notifications overlay */}
      <RealTimeNotificationToast />

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
                <NewEvent />
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
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:userId" element={<ChatPage />} />
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
    </AuthProvider>
  );
}

export default App;
