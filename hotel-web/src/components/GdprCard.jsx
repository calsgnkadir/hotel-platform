import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api/client'

/**
 * FAZ D.8 — KVKK haklari kartı.
 * - Verilerimi indir: GET /api/me/export -> JSON dosyası
 * - Hesabımı sil:    DELETE /api/me -> 30 gün grace
 */
export default function GdprCard() {
  const [exporting, setExporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/api/me/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `ajanshotel-verim-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Verileriniz indirildi')
    } catch (e) {
      toast.error('Veri indirilemedi')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { data } = await api.delete('/api/me')
      toast.success(data?.message || 'Hesabınız silme sırasına alındı', { duration: 8000 })
      // 30 sn sonra logout (kullanıcı mesajı okuyabilsin)
      setTimeout(() => {
        localStorage.clear()
        window.location.href = '/login'
      }, 3000)
    } catch (e) {
      toast.error('İşlem başarısız oldu')
      setDeleting(false)
    }
  }

  return (
    <div className="card p-5" style={{ marginTop: 16 }}>
      <h3 style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#1f2937',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        KVKK · Verileriniz
      </h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
        KVKK madde 11 kapsamında verilerinize erişme ve silme hakkınız vardır.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: 'rgba(30, 58, 95, 0.08)',
            color: '#1e3a5f',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid rgba(30, 58, 95, 0.2)',
            cursor: exporting ? 'wait' : 'pointer',
            transition: 'all 200ms',
          }}>
          {exporting ? 'Hazırlanıyor...' : 'Verilerimi İndir (JSON)'}
        </button>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              background: 'transparent',
              color: '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid rgba(185, 28, 28, 0.3)',
              cursor: 'pointer',
            }}>
            Hesabımı Sil
          </button>
        ) : (
          <div style={{
            padding: 14,
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 12, lineHeight: 1.5 }}>
              Bu işlem geri alınamaz. Hesabınız 30 gün içinde anonymize edilecek.
              30 gün boyunca destek hattından geri alabilirsiniz.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#b91c1c',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: deleting ? 'wait' : 'pointer',
                }}>
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}>
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
