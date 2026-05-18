import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  async function onSubmit(data) {
    try {
      const result = await login(data.email, data.password)
      const redirectTo = location.state?.from?.pathname
      if (redirectTo) {
        navigate(redirectTo, { replace: true })
      } else if (result.role === 'CANDIDATE') {
        navigate('/candidate', { replace: true })
      } else if (result.role === 'BUSINESS_OWNER') {
        navigate('/business', { replace: true })
      } else if (result.role === 'ADMIN') {
        navigate('/admin', { replace: true })
      }
      toast.success(`Hoş geldiniz, ${result.fullName}!`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
            <span className="text-2xl">🏨</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">AjansHotel'e Hoş Geldiniz</h1>
          <p className="text-sm text-slate-500 mt-1">
            Aday veya işletme hesabınızla giriş yapın
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">E-posta Adresi</label>
            <input
              type="email"
              className="input"
              placeholder="ornek@email.com"
              {...register('email', {
                required: 'E-posta zorunlu',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
              })}
            />
            {errors.email && <p className="error-text">⚠ {errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Şifre</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...register('password', {
                required: 'Şifre zorunlu',
                minLength: { value: 8, message: 'En az 8 karakter' },
              })}
            />
            {errors.password && <p className="error-text">⚠ {errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Giriş yapılıyor...
              </span>
            ) : 'Giriş Yap →'}
          </button>
        </form>

        <p className="text-sm text-center text-slate-500 mt-6">
          Hesabın yok mu?{' '}
          <Link to="/register" className="font-semibold hover:text-violet-700" style={{ color: '#7c3aed' }}>
            Ücretsiz kayıt ol
          </Link>
        </p>
      </div>
    </div>
  )
}
