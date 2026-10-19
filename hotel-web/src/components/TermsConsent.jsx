import { Link } from 'react-router-dom'
import { TERMS_PATH, KVKK_PATH } from '../lib/legal'

/**
 * Kayıt onayı — kayıt formu, kayıt adım 1 (Google), giriş penceresi ve Google
 * dönüşündeki onay ekranı aynı bileşeni kullanır.
 *
 * Hukuki ayrım (bilinçli):
 *  - Kullanım Şartları: sözleşme → ayrı, zorunlu onay kutusu (önceden işaretli değil).
 *  - KVKK Aydınlatma Metni: onay DEĞİL, bilgilendirme → yalnız okuma bağlantısı.
 *    Aydınlatma, açık rızayla aynı kutuya bağlanmaz.
 */
export default function TermsConsent({ id = 'terms-consent', checked, onChange, error, compact = false }) {
  const errorId = `${id}-error`
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer type-meta"
             style={{ color: 'var(--ah-ink-2)' }}>
        <input id={id} type="checkbox" checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
          style={{ accentColor: 'var(--ah-brand)' }} />
        <span>
          <Link to={TERMS_PATH} target="_blank" rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2" style={{ color: 'var(--ah-ink)' }}>
            Kullanım Şartları
          </Link>
          'nı okudum ve kabul ediyorum.
        </span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="type-caption pl-[26px]" style={{ color: 'var(--ah-danger)' }}>
          {error}
        </p>
      )}
      <p className="type-caption pl-[26px]" style={{ color: 'var(--ah-ink-3)' }}>
        Kişisel verilerinin nasıl işlendiğini{' '}
        <Link to={KVKK_PATH} target="_blank" rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2" style={{ color: 'var(--ah-ink-2)' }}>
          Aydınlatma Metni
        </Link>
        'nde okuyabilirsin.
      </p>
    </div>
  )
}
