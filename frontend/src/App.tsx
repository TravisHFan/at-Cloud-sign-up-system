import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
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
import ChatList from "./pages/ChatList";
import ChatWindow from "./pages/ChatWindow";
import DashboardLayout from "./layouts/DashboardLayout";
import EventDetail from "./pages/EventDetail";

function App() {
  return (
    <AuthProvider>
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
          <Route path="new-event" element={<NewEvent />} />
          <Route path="management" element={<Management />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:userId" element={<UserProfile />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="system-messages" element={<SystemMessages />} />
          <Route path="chat" element={<ChatList />} />
          <Route path="chat/:userId" element={<ChatWindow />} />
        </Route>
        <Route path="/dashboard/event/:id" element={<EventDetail />} />
        <Route path="/logout" element={<Home />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
