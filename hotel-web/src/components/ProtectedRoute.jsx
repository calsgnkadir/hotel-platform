import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Kullanım:
 *   <ProtectedRoute roles={['STUDENT']}>
 *     <StudentDashboard />
 *   </ProtectedRoute>
 *
 * roles boş ise sadece giriş kontrolü yapılır, rol önemli değildir.
 */
export default function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Auth context hâlâ localStorage'dan okuyorsa bekle
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    )
  }

  // Giriş yapılmamışsa login'e yönlendir, geldiği yolu state'te taşı
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Rol gerekiyor ama kullanıcının rolü uygun değilse ana sayfaya
  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
