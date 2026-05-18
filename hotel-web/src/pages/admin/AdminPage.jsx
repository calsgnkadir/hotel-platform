import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function AdminPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
             style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
          <span className="text-3xl">🛡️</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Paneli</h1>
        <p className="text-slate-500 mb-8">Admin araçları Faz D'de eklenecek.</p>
        <button onClick={handleLogout}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}
