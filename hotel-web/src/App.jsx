import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import LandingPage from './pages/LandingPage'
import CandidateDashboard from './pages/candidate/CandidateDashboard'
import BusinessDashboard from './pages/business/BusinessDashboard'
import AdminPage from './pages/admin/AdminPage'
import KvkkPage from './pages/KvkkPage'

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />

        <Routes>
          {/* Public */}
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/kvkk"     element={<KvkkPage />} />

          {/* Candidate panel */}
          <Route
            path="/candidate/*"
            element={
              <ProtectedRoute roles={['CANDIDATE']}>
                <CandidateDashboard />
              </ProtectedRoute>
            }
          />

          {/* Business owner panel */}
          <Route
            path="/business/*"
            element={
              <ProtectedRoute roles={['BUSINESS_OWNER']}>
                <BusinessDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin panel */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route path="*"  element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
