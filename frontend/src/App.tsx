import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SignUp from './pages/SignUp'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardLayout from './layouts/DashboardLayout'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        } />
      </Routes>
    </div>
  );
}

export default App;
