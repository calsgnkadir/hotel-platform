import { useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'

/**
 * Şifre değiştirme kartı.
 * Tüm rollerde kullanılır (aday, işletme, admin) — ProfileTab'a entegre.
 */
export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!currentPassword) return toast.error('Mevcut şifrenizi girin')
    if (!newPassword) return toast.error('Yeni şifrenizi girin')
    if (newPassword.length < 8) return toast.error('Yeni şifre en az 8 karakter olmalı')
    if (newPassword !== confirmPassword) return toast.error('Yeni şifreler aynı değil')
    if (currentPassword === newPassword) return toast.error('Yeni şifre eskisinden farklı olmalı')

    setLoading(true)
    try {
      await hotelApi.changePassword(currentPassword, newPassword)
      toast.success('Şifreniz başarıyla değiştirildi')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-ink-800 uppercase tracking-wider">Şifre Değiştir</h3>
        <p className="text-xs text-ink-500 mt-1">
          Güvenliğiniz için zaman zaman şifrenizi yenileyin
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Mevcut Şifre</label>
          <input type={showPasswords ? 'text' : 'password'}
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
            autoComplete="current-password" />
        </div>

        <div>
          <label className="label">Yeni Şifre</label>
          <input type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="input"
            placeholder="En az 8 karakter"
            autoComplete="new-password" />
        </div>

        <div>
          <label className="label">Yeni Şifre (Tekrar)</label>
          <input type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Yeni şifreyi tekrar girin"
            autoComplete="new-password" />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-600 mt-1">Şifreler eşleşmiyor</p>
          )}
          {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
            <p className="text-xs text-brand-700 mt-1">Şifreler eşleşiyor</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer select-none">
          <input type="checkbox" checked={showPasswords}
            onChange={e => setShowPasswords(e.target.checked)}
            className="w-4 h-4 accent-brand-700" />
          Şifreleri göster
        </label>

        <div className="pt-2">
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}>
            {loading ? 'Değiştiriliyor...' : 'Şifreyi Güncelle'}
          </button>
        </div>
      </form>
    </div>
  )
}
