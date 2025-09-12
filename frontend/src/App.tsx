import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { NotificationProvider as NotificationModalProvider } from "./contexts/NotificationModalContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import CheckEmail from "./pages/CheckEmail";
import EmailVerification from "./pages/EmailVerification";
import Welcome from "./pages/Welcome";
import UpcomingEvents from "./pages/UpcomingEvents";
import PassedEvents from "./pages/PassedEvents";
import MyEvents from "./pages/MyEvents";
import CreateEvent from "./pages/CreateEvent";
import RecurringEventConfig from "./pages/RecurringEventConfig";
import Management from "./pages/Management";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import RequestPasswordChange from "./pages/RequestPasswordChange";
import CompletePasswordChange from "./pages/CompletePasswordChange";
import ResetPassword from "./pages/ResetPassword";
import SystemMessages from "./pages/SystemMessages";
import Analytics from "./pages/Analytics";
import SystemMonitor from "./pages/SystemMonitor";
import EditEvent from "./pages/EditEvent";
import Feedback from "./pages/Feedback";
import DashboardLayout from "./layouts/DashboardLayout";
import GuestDashboardLayout from "./layouts/GuestDashboardLayout";
import EventDetail from "./pages/EventDetail";
import GetInvolved from "./pages/GetInvolved";
import GuestRegistration from "./pages/GuestRegistration.tsx";
import GuestWelcome from "./pages/guest/GuestWelcome";
import GuestUpcomingEvents from "./pages/guest/GuestUpcomingEvents";
import GuestMyEvents from "./pages/guest/GuestMyEvents";
import GuestConfirmation from "./pages/GuestConfirmation.tsx";
import GuestManage from "./pages/GuestManage.tsx";
import AssignmentRejection from "./pages/AssignmentRejection";

function App() {
  return (
    <AuthProvider>
      <NotificationModalProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            {/* Public guest routes (migrated to root) */}
            <Route path="/guest-register/:id" element={<GuestRegistration />} />
            <Route path="/guest-confirmation" element={<GuestConfirmation />} />
            <Route path="/guest-manage/:token" element={<GuestManage />} />
            {/* Public role assignment rejection route */}
            <Route
              path="/assignments/reject"
              element={<AssignmentRejection />}
            />
            {/* Guest Dashboard (public) */}
            <Route path="/guest-dashboard" element={<GuestDashboardLayout />}>
              <Route index element={<GuestWelcome />} />
              <Route path="welcome" element={<GuestWelcome />} />
              <Route path="upcoming" element={<GuestUpcomingEvents />} />
              <Route path="my-events" element={<GuestMyEvents />} />
            </Route>
            <Route path="/check-email" element={<CheckEmail />} />
            <Route
              path="/verify-email/:token"
              element={<EmailVerification />}
            />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route
              path="/change-password/confirm/:token"
              element={<CompletePasswordChange />}
            />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Welcome />} />
              <Route path="welcome" element={<Welcome />} />
              <Route path="upcoming" element={<UpcomingEvents />} />
              <Route path="passed" element={<PassedEvents />} />
              <Route path="my-events" element={<MyEvents />} />
              <Route
                path="event-config"
                element={
                  // Allow all authenticated roles; page will show access notice for Participants
                  <ProtectedRoute
                    allowedRoles={[
                      "Super Admin",
                      "Administrator",
                      "Leader",
                      "Participant",
                      "Guest Expert",
                    ]}
                  >
                    <RecurringEventConfig />
                  </ProtectedRoute>
                }
              />
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
                    allowedRoles={[
                      "Super Admin",
                      "Administrator",
                      "Leader",
                      "Participant",
                      "Guest Expert",
                    ]}
                  >
                    <Management />
                  </ProtectedRoute>
                }
              />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/:userId" element={<UserProfile />} />
              <Route
                path="change-password"
                element={<RequestPasswordChange />}
              />
              <Route path="system-messages" element={<SystemMessages />} />
              <Route path="get-involved" element={<GetInvolved />} />
              <Route
                path="edit-event/:id"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <EditEvent />
                  </ProtectedRoute>
                }
              />
              <Route
                path="analytics"
                element={
                  // Allow all authenticated roles; page handles restricted view for Participants
                  <ProtectedRoute
                    allowedRoles={[
                      "Super Admin",
                      "Administrator",
                      "Leader",
                      "Participant",
                      "Guest Expert",
                    ]}
                  >
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="monitor"
                element={
                  <ProtectedRoute allowedRoles={["Super Admin"]}>
                    <SystemMonitor />
                  </ProtectedRoute>
                }
              />
              <Route path="feedback" element={<Feedback />} />
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
      </NotificationModalProvider>
    </AuthProvider>
  );
}

export default App;
