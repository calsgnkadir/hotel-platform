import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import CandidateDashboard from './pages/candidate/CandidateDashboard'
import BusinessDashboard from './pages/business/BusinessDashboard'
import AdminPage from './pages/admin/AdminPage'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'CANDIDATE') return <Navigate to="/candidate" replace />
  if (user.role === 'BUSINESS_OWNER') return <Navigate to="/business" replace />
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />

        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

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

          {/* Admin panel — placeholder */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route path="/"  element={<RootRedirect />} />
          <Route path="*"  element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
