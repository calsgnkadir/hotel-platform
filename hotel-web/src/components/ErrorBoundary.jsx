/**
 * FAZ 3 — Error Boundary.
 *
 * Component agacindaki herhangi bir render hatasini yakalar, beyaz ekran
 * yerine kullaniciya anlamli bir hata sayfasi gosterir. Cocuk component'ler
 * cokerse bile uygulamanin geri kalani calismaya devam edebilir.
 */
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Console'a log + ileride Sentry/LogRocket entegrasyonu icin hook noktasi
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100 p-6">
        <div className="card max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white"
               style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={1.8} className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-ink-900 mb-2">Bir şeyler ters gitti</h1>
          <p className="text-sm text-ink-500 mb-4">
            Beklenmedik bir hata oluştu. Sayfayı yenilersen büyük ihtimalle düzelir.
          </p>
          {this.state.error?.message && (
            <details className="text-left mb-4">
              <summary className="text-xs text-ink-400 cursor-pointer hover:text-ink-600">
                Teknik detay
              </summary>
              <pre className="text-[10px] bg-cream-50 dark:bg-ink-800 p-2 rounded mt-2 overflow-auto max-h-32">
                {String(this.state.error.message)}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button onClick={this.handleReset}
              className="btn-secondary flex-1 text-sm">
              Tekrar dene
            </button>
            <button onClick={this.handleReload}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)' }}>
              Sayfayı Yenile
            </button>
          </div>
        </div>
      </div>
    )
  }
}
