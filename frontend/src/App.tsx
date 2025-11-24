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
import PublishedEvents from "./pages/PublishedEvents";
import Programs from "./pages/Programs";
import ProgramDetail from "./pages/ProgramDetail";
import EnrollProgram from "./pages/EnrollProgram";
import PurchaseSuccess from "./pages/PurchaseSuccess";
import PurchaseCancel from "./pages/PurchaseCancel";
import PurchaseHistory from "./pages/PurchaseHistory";
import PurchaseReceipt from "./pages/PurchaseReceipt";
import IncomeHistory from "./pages/IncomeHistory";
import CreateNewProgram from "./pages/CreateNewProgram";
import EditProgram from "./pages/EditProgram";
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
import AuditLogs from "./pages/AuditLogs";
import DashboardLayout from "./layouts/DashboardLayout";
import EventDetail from "./pages/EventDetail";
import GetInvolved from "./pages/GetInvolved";
import GuestRegistration from "./pages/GuestRegistration.tsx";
import GuestConfirmation from "./pages/GuestConfirmation.tsx";
import GuestManage from "./pages/GuestManage.tsx";
import AssignmentRejection from "./pages/AssignmentRejection";
import GuestDecline from "./pages/GuestDecline";
import PublicEvent from "./pages/PublicEvent";
import PublicEventsList from "./pages/PublicEventsList";
import ShortLinkRedirect from "./pages/ShortLinkRedirect";
import ConfigureRolesTemplates from "./pages/ConfigureRolesTemplates";
import CreateRolesTemplate from "./pages/CreateRolesTemplate";
import EditRolesTemplate from "./pages/EditRolesTemplate";
import ViewRolesTemplate from "./pages/ViewRolesTemplate";
import MyPromoCodes from "./pages/MyPromoCodes";
import AdminPromoCodes from "./pages/AdminPromoCodes";
import PromoCodeDetail from "./pages/PromoCodeDetail";
import DonationPage from "./pages/DonationPage";
import DonationReceipt from "./pages/DonationReceipt";
import SessionExpiredModal from "./components/common/SessionExpiredModal";
import EventPurchase from "./pages/EventPurchase";
import EventPurchaseSuccess from "./pages/EventPurchaseSuccess";

function App() {
  return (
    <AuthProvider>
      <NotificationModalProvider>
        <NotificationProvider>
          <SessionExpiredModal />
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
            {/* Guest invitation decline route */}
            <Route path="/guest/decline/:token" element={<GuestDecline />} />
            {/* Guest dashboard routes removed (legacy self-registration UI deprecated) */}
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
              <Route index element={<Programs />} />
              <Route path="welcome" element={<Welcome />} />
              <Route path="upcoming" element={<UpcomingEvents />} />
              <Route path="passed" element={<PassedEvents />} />
              <Route path="my-events" element={<MyEvents />} />
              <Route
                path="published-events"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <PublishedEvents />
                  </ProtectedRoute>
                }
              />
              <Route path="programs" element={<Programs />} />
              <Route path="programs/:id" element={<ProgramDetail />} />
              <Route path="programs/:id/enroll" element={<EnrollProgram />} />
              <Route path="purchase-history" element={<PurchaseHistory />} />
              <Route
                path="purchase-receipt/:id"
                element={<PurchaseReceipt />}
              />
              <Route
                path="purchases/:id/receipt"
                element={<PurchaseReceipt />}
              />
              <Route
                path="income-history"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator"]}
                  >
                    <IncomeHistory />
                  </ProtectedRoute>
                }
              />
              <Route path="purchase/success" element={<PurchaseSuccess />} />
              <Route path="purchase/cancel" element={<PurchaseCancel />} />
              <Route
                path="programs/:id/edit"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <EditProgram />
                  </ProtectedRoute>
                }
              />
              <Route
                path="programs/new"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <CreateNewProgram />
                  </ProtectedRoute>
                }
              />
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
              <Route
                path="audit-logs"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator"]}
                  >
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              <Route path="feedback" element={<Feedback />} />
              {/* Donation Page - Available to all authenticated users */}
              <Route path="donate" element={<DonationPage />} />
              {/* Donation Receipt - Available to all authenticated users */}
              <Route path="donation-receipt" element={<DonationReceipt />} />
              {/* User: My Promo Codes - Available to all authenticated users */}
              <Route path="promo-codes" element={<MyPromoCodes />} />
              {/* Admin: Promo Codes Management - Super Admin & Administrator only */}
              <Route
                path="admin/promo-codes"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator"]}
                  >
                    <AdminPromoCodes />
                  </ProtectedRoute>
                }
              />
              {/* Admin: Promo Code Detail - Super Admin & Administrator only */}
              <Route
                path="admin/promo-codes/:id"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator"]}
                  >
                    <PromoCodeDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="configure-roles-templates"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <ConfigureRolesTemplates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="create-roles-template"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <CreateRolesTemplate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="edit-roles-template/:id"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <EditRolesTemplate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="view-roles-template/:id"
                element={
                  <ProtectedRoute
                    allowedRoles={["Super Admin", "Administrator", "Leader"]}
                  >
                    <ViewRolesTemplate />
                  </ProtectedRoute>
                }
              />
            </Route>
            {/* Paid Events Purchase Flow (Phase 6) */}
            <Route
              path="/dashboard/events/:id/purchase"
              element={
                <ProtectedRoute>
                  <EventPurchase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/events/:id/purchase/success"
              element={
                <ProtectedRoute>
                  <EventPurchaseSuccess />
                </ProtectedRoute>
              }
            />
            {/* Event Detail Page */}
            <Route
              path="/dashboard/event/:id"
              element={
                <ProtectedRoute>
                  <EventDetail />
                </ProtectedRoute>
              }
            />
            <Route path="/logout" element={<Home />} />
            {/* Public events list page (unauthenticated) */}
            <Route path="/events" element={<PublicEventsList />} />
            {/* Public published event page (unauthenticated) */}
            <Route path="/p/:slug" element={<PublicEvent />} />
            {/* SPA fallback for short link resolution (dev / proxy safety) */}
            <Route path="/s/:key" element={<ShortLinkRedirect />} />
          </Routes>
        </NotificationProvider>
      </NotificationModalProvider>
    </AuthProvider>
  );
}

export default App;
