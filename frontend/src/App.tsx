import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Welcome from "./pages/Welcome";
import UpcomingEvents from "./pages/UpcomingEvents";
import PassedEvents from "./pages/PassedEvents";
import NewEvent from "./pages/NewEvent";
import Management from "./pages/Management";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import DashboardLayout from "./layouts/DashboardLayout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <DashboardLayout>
            <Welcome />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/welcome"
        element={
          <DashboardLayout>
            <Welcome />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/upcoming"
        element={
          <DashboardLayout>
            <UpcomingEvents />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/passed"
        element={
          <DashboardLayout>
            <PassedEvents />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/new-event"
        element={
          <DashboardLayout>
            <NewEvent />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/management"
        element={
          <DashboardLayout>
            <Management />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/profile"
        element={
          <DashboardLayout>
            <Profile />
          </DashboardLayout>
        }
      />
      <Route
        path="/dashboard/change-password"
        element={
          <DashboardLayout>
            <ChangePassword />
          </DashboardLayout>
        }
      />
    </Routes>
  );
}

export default App;
