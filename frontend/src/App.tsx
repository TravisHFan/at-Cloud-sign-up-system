import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UpcomingEvents from "./pages/UpcomingEvents";
import PassedEvents from "./pages/PassedEvents";
import NewEvent from "./pages/NewEvent";
import Management from "./pages/Management";
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
            <Dashboard />
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
    </Routes>
  );
}

export default App;
