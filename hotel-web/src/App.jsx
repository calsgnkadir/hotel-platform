import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { initHapticForToasts } from './lib/haptic'  // FAZ 3
import { queryClient } from './lib/queryClient'
import { lazyPage } from './lib/lazyPage'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'  // ilk giriş kapısı: ana paketle gelsin

// Diğer sayfalar ilk ziyarette ayrı parça olarak iner (lazy loading):
// ana sayfaya gelen, hiç girmeyeceği panel/harita/grafik kodunu indirmez.
const LoginPage           = lazyPage(() => import('./pages/auth/LoginPage'))
const RegisterPage        = lazyPage(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage  = lazyPage(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage   = lazyPage(() => import('./pages/auth/ResetPasswordPage'))
const OAuthSuccessPage    = lazyPage(() => import('./pages/auth/OAuthSuccessPage'))
const CandidateDashboard  = lazyPage(() => import('./pages/candidate/CandidateDashboard'))
const BusinessDashboard   = lazyPage(() => import('./pages/business/BusinessDashboard'))
const AdminPage           = lazyPage(() => import('./pages/admin/AdminPage'))
const KvkkPage            = lazyPage(() => import('./pages/KvkkPage'))
const TermsPage           = lazyPage(() => import('./pages/TermsPage'))
const HelpPage            = lazyPage(() => import('./pages/HelpPage'))
const ContactPage         = lazyPage(() => import('./pages/ContactPage'))
const VerifyEmailPage     = lazyPage(() => import('./pages/VerifyEmailPage'))
const ListingDetailPage   = lazyPage(() => import('./pages/candidate/ListingDetailPage'))
const ScanPassPage        = lazyPage(() => import('./pages/business/ScanPassPage'))  // giriş kartı okutma (görevli)
const BusinessPublicPage  = lazyPage(() => import('./pages/public/BusinessPublicPage'))  // FAZ 5.9
const CandidatePublicPage = lazyPage(() => import('./pages/public/CandidatePublicPage'))  // Dalga G
const NotFoundPage        = lazyPage(() => import('./pages/NotFoundPage'))  // FAZ 3 - 404
// FAZ 1/#23 — Web Push prompt (pure Java VAPID, in-app calisiyor)
import PushPermissionPrompt from './components/PushPermissionPrompt'
// FAZ 2/#8 — PWA install prompt
import InstallPrompt from './components/InstallPrompt'
// FAZ 3 — Error boundary
import ErrorBoundary from './components/ErrorBoundary'
// FAZ 3 — A11y: Skip-to-content link
import SkipLink from './components/SkipLink'
import ShowcaseBanner from './components/ShowcaseBanner'  // CV vitrini uyarısı (VITE_SHOWCASE)
// FAZ 5.3 — Command Palette Ctrl+K
import CommandPalette from './components/CommandPalette'
// FAZ 5.10 — Klavye kisayollari (? + g+harf chord)
import KeyboardShortcuts from './components/KeyboardShortcuts'
// FAZ 5.11 — Visual delights
import ScrollProgressBar from './components/ScrollProgressBar'
// FAZ 5.4 — Framer Motion root config (reducedMotion respect)
import { MotionConfig } from 'framer-motion'
// FAZ I.1 — KVKK cookie consent banner
import CookieConsent from './components/CookieConsent'
// FAZ 8 — Global imperative confirm dialog (Promise-based useConfirm hook)
import { ConfirmProvider } from './lib/useConfirm'

export default function App() {
  useEffect(() => { initHapticForToasts() }, [])  // FAZ 3 - mobile haptic
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <MotionConfig reducedMotion="user" transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
      <ConfirmProvider>
        <SkipLink />              {/* FAZ 3 / A11y — klavye Tab ilk durak */}
        <ShowcaseBanner />
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <PushPermissionPrompt />  {/* FAZ 1/#23 — Web Push */}
        <InstallPrompt />          {/* FAZ 2/#8 — PWA install */}
        <CommandPalette />         {/* FAZ 5.3 — Ctrl+K global arama */}
        <KeyboardShortcuts />      {/* FAZ 5.10 — ? help + g+harf chord */}
        <ScrollProgressBar />      {/* FAZ 5.11 — sticky scroll progress */}
        <CookieConsent />          {/* FAZ I.1 — KVKK çerez tercihi */}

        <main id="main">
          <AnimatedRoutes />
        </main>
      </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
    </MotionConfig>
    </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}

// FAZ 3 — Route degisiminde sade fade-in. Sadece root segment'i key olarak
// kullaniyoruz (ornegin /candidate icindeki tab degisiminde animasyon
// re-tetiklenmesin, sadece /candidate -> /business gibi sayfa degisiminde).
function AnimatedRoutes() {
  const location = useLocation()
  const rootKey = location.pathname.split('/')[1] || 'root'
  return (
    <div key={rootKey} className="page-enter">
      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/oauth-success"   element={<OAuthSuccessPage />} />
        <Route path="/kvkk"            element={<KvkkPage />} />
        <Route path="/terms"           element={<TermsPage />} />
        <Route path="/yardim"          element={<HelpPage />} />
        <Route path="/iletisim"        element={<ContactPage />} />
        <Route path="/verify-email"    element={<VerifyEmailPage />} />

        {/* FAZ 1/#47 — Public listing detail (paylasilabilir URL) */}
        <Route path="/listings/:id"    element={<ListingDetailPage />} />
        {/* Giriş kartı: görevli çalışanın QR'ını okutunca açılır (işletme hesabı; giriş yoksa login → geri döner) */}
        <Route path="/giris/:token"    element={<ProtectedRoute roles={['BUSINESS_OWNER']}><ScanPassPage /></ProtectedRoute>} />

        {/* FAZ 5.9 — Public isletme profil (paylasilabilir + SEO) */}
        <Route path="/p/business/:id"  element={<BusinessPublicPage />} />

        {/* Dalga G — Aday public profili (yetki: ilgili isletme + admin) */}
        <Route path="/p/candidate/:id" element={<ProtectedRoute><CandidatePublicPage /></ProtectedRoute>} />

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

        {/* FAZ 3 — 404 fallback (replace Navigate ile sessiz redirect yerine bilgi sayfasi) */}
        <Route path="*"  element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </div>
  )
}

// Sayfa parçası inerken: hızlı bağlantıda göz kırpması olmasın diye ilk
// 250 ms boş kalır, sonra ince bir yükleniyor çubuğu gösterir.
function PageFallback() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 250)
    return () => clearTimeout(id)
  }, [])
  return (
    <div role="status" aria-live="polite" className="min-h-[60vh]">
      {visible && (
        <>
          <div className="fixed top-0 left-0 right-0 h-0.5 overflow-hidden z-50"
               style={{ background: 'var(--ah-line)' }}>
            <div className="h-full w-1/3 animate-pulse" style={{ background: 'var(--ah-ink)' }} />
          </div>
          <span className="sr-only">Sayfa yükleniyor</span>
        </>
      )}
    </div>
  )
}

