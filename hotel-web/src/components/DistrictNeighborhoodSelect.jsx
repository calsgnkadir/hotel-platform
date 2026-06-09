import { useMemo } from 'react'
import { ISTANBUL_DISTRICTS, neighborhoodsOf } from '../data/istanbul'

const OTHER = '__OTHER__'

/**
 * İlçe + Mahalle cascading select.
 * - İlçe değişince mahalle otomatik temizlenir.
 * - Mahalle listede yoksa "Diğer..." seçilir, altta text input açılır.
 *
 * Props:
 *   district, neighborhood: mevcut değerler (string)
 *   onChange({district, neighborhood}): herhangi biri değişince çağrılır
 *   districtRequired?: boolean — true ise "Seçin" placeholder olur
 *   className?: dış container class
 */
export default function DistrictNeighborhoodSelect({
  district = '',
  neighborhood = '',
  onChange,
  districtRequired = false,
  className = '',
}) {
  const neighborhoods = useMemo(() => neighborhoodsOf(district), [district])

  // Mevcut mahalle, listenin bilinen birinden mi?
  const isKnown = neighborhood && neighborhoods.includes(neighborhood)
  // "Diğer..." aktif mi? (mahalle dolu ama listede yok)
  const isOther = neighborhood && !isKnown

  function handleDistrictChange(e) {
    onChange?.({ district: e.target.value, neighborhood: '' })
  }

  function handleNeighborhoodChange(e) {
    const v = e.target.value
    if (v === OTHER) {
      onChange?.({ district, neighborhood: '' })  // text input açar, kullanıcı yazar
    } else {
      onChange?.({ district, neighborhood: v })
    }
  }

  function handleOtherText(e) {
    onChange?.({ district, neighborhood: e.target.value })
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
      {/* İlçe */}
      <div>
        <label className="label">İlçe {districtRequired && '*'}</label>
        <select value={district} onChange={handleDistrictChange} className="input">
          <option value="">{districtRequired ? 'Seçin' : '— Seçin —'}</option>
          {ISTANBUL_DISTRICTS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Mahalle */}
      <div>
        <label className="label">Mahalle</label>
        <select
          value={isOther ? OTHER : (isKnown ? neighborhood : '')}
          onChange={handleNeighborhoodChange}
          disabled={!district}
          className="input disabled:bg-cream-50 disabled:text-ink-400 disabled:cursor-not-allowed">
          <option value="">{district ? '— Seçin —' : 'Önce ilçe seçin'}</option>
          {neighborhoods.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
          {district && <option value={OTHER}>Diğer…</option>}
        </select>

        {isOther && (
          <input type="text" value={neighborhood} onChange={handleOtherText}
            placeholder="Mahalle adını yazın" maxLength={60}
            className="input mt-2 text-sm" />
        )}
      </div>
    </div>
  )
}
