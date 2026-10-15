/**
 * Veri yüklenemediğinde gösterilen ortak hata kartı + "Tekrar dene".
 * Render sırasında toast atmak yerine kullanılır (toast her render'da
 * tekrarlanır ve kullanıcıya bir çıkış yolu sunmaz).
 */
export default function LoadError({ message = 'Veriler yüklenemedi.', onRetry, retrying = false, className = '' }) {
  return (
    <div className={`card p-6 text-center space-y-3 ${className}`} role="alert">
      <p className="type-body">{message}</p>
      <p className="type-caption">Bağlantını kontrol edip yeniden dene.</p>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className="btn-secondary">
          {retrying ? 'Deneniyor' : 'Tekrar dene'}
        </button>
      )}
    </div>
  )
}
