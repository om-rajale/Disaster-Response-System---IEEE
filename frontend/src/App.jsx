import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import CitizenPortal from './pages/CitizenPortal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RescueDashboard from './pages/RescueDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AccessDenied from './pages/AccessDenied';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans selection:bg-emergency-red/30 selection:text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Citizen View (Report Form + Public Map) */}
              <Route path="/" element={<CitizenPortal />} />

              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/access-denied" element={<AccessDenied />} />

              {/* Protected Rescue Team Operations Dashboard */}
              <Route
                path="/rescue"
                element={
                  <ProtectedRoute allowedRoles={['rescue_team', 'admin']}>
                    <RescueDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Commander Dashboard */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
