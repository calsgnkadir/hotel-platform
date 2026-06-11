import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import OAuthSuccessPage from './pages/auth/OAuthSuccessPage'
import LandingPage from './pages/LandingPage'
import CandidateDashboard from './pages/candidate/CandidateDashboard'
import BusinessDashboard from './pages/business/BusinessDashboard'
import AdminPage from './pages/admin/AdminPage'
import KvkkPage from './pages/KvkkPage'
import ListingDetailPage from './pages/candidate/ListingDetailPage'
// FAZ 1/#23 — Push prompt gecici devre disi (backend hazir olunca tekrar acilir)
// import PushPermissionPrompt from './components/PushPermissionPrompt'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />

        <Routes>
          {/* Public */}
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/oauth-success"   element={<OAuthSuccessPage />} />
          <Route path="/kvkk"            element={<KvkkPage />} />

          {/* FAZ 1/#47 — Public listing detail (paylasilabilir URL) */}
          <Route path="/listings/:id"    element={<ListingDetailPage />} />

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
    </QueryClientProvider>
  )
}
