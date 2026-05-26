import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import ListingsPage from './ListingsPage'

const ISTANBUL_DISTRICTS = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu',
]
const GENDER_LABELS = { MALE: 'Erkek', FEMALE: 'Kadın', OTHER: 'Diğer' }
const EDUCATION_LABELS = {
  HIGH_SCHOOL: 'Lise',
  UNIVERSITY_GRADUATE: 'Üniversite',
}
const LANGUAGE_LABELS = {
  TURKISH:  'Türkçe',  ENGLISH:  'İngilizce', GERMAN:   'Almanca',
  RUSSIAN:  'Rusça',   ARABIC:   'Arapça',    FRENCH:   'Fransızca',
  SPANISH:  'İspanyolca', ITALIAN: 'İtalyanca',
}
const AVAILABILITY_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
}
const SENSITIVE_DOC_TYPES_CAND = ['CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT']

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'badge-pending',   icon: '⏳', label: 'Bekliyor' },
    REVIEWING: { cls: 'badge-reviewing', icon: '🔍', label: 'İnceleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  icon: '✅', label: 'Kabul' },
    REJECTED:  { cls: 'badge-rejected',  icon: '❌', label: 'Red' },
    EXPIRED:   { cls: 'badge-expired',   icon: '⌛', label: 'Süresi Doldu' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
}

/* ── Applications Tab ── */
function ApplicationsTab({ applications, onRefresh }) {
  const [respondingId, setRespondingId] = useState(null)
  const [myDocs, setMyDocs] = useState([])

  // Aday'ın yüklediği belge tipleri — Onayla butonunu validate için
  useEffect(() => {
    hotelApi.getMyDocuments().then(setMyDocs).catch(() => setMyDocs([]))
  }, [applications])  // başvuru güncellenince belgeler de yeniden okunsun

  const uploadedTypes = new Set(myDocs.map(d => d.type))

  async function handleRespond(reqId, grant) {
    setRespondingId(reqId)
    try {
      await hotelApi.respondDocumentRequest(reqId, grant)
      toast.success(grant ? 'Belgeye izin verildi' : 'Talep reddedildi')
      onRefresh?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setRespondingId(null)
    }
  }

  if (applications.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="text-4xl mb-3">📋</span>
          <p className="font-medium text-slate-700">Henüz başvurunuz yok</p>
          <p className="text-sm text-slate-500 mt-1">İlanlar bölümünden bir ilana başvurun</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {applications.map(app => (
        <div key={app.id} className="card">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
                   style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                🏨
              </div>
              <div>
                <div className="font-semibold text-slate-800">{app.listing?.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{app.listing?.businessName}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
            <StatusBadge status={app.status} />
          </div>

          {app.note && (
            <div className="px-4 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                <span className="font-medium">İşletme Notu:</span> {app.note}
              </div>
            </div>
          )}

          {app.documentRequests?.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Belge Talepleri</div>
              <div className="space-y-2">
                {app.documentRequests.map(dr => {
                  const label = DOC_TYPE_LABELS[dr.documentType] || dr.documentType
                  const isPending = dr.status === 'PENDING'
                  const hasUploaded = uploadedTypes.has(dr.documentType)
                  return (
                    <div key={dr.id}
                      className={`rounded-lg px-3 py-2.5 ${isPending ? 'bg-violet-50 border border-violet-200' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm text-slate-700 font-medium">{label}</span>
                        {!isPending && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            dr.status === 'GRANTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {dr.status === 'GRANTED' ? 'İzin Verdin' : 'Reddettin'}
                          </span>
                        )}
                      </div>
                      {isPending && (
                        <>
                          {!hasUploaded && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                              ⚠ Bu belgeyi henüz yüklemedin. <b>Belgelerim</b> sekmesinden yükledikten sonra izin verebilirsin.
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleRespond(dr.id, true)}
                              disabled={respondingId === dr.id || !hasUploaded}
                              title={!hasUploaded ? 'Önce bu belgeyi yükle' : ''}
                              className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                              İzin Ver
                            </button>
                            <button onClick={() => handleRespond(dr.id, false)}
                              disabled={respondingId === dr.id}
                              className="flex-1 py-1.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50">
                              Reddet
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Documents Tab ── */
function DocumentsTab() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('CV')

  const docTypes = ['CV', 'TRANSCRIPT', 'CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT']

  const fetchDocs = useCallback(async () => {
    try {
      const data = await hotelApi.getMyDocuments()
      setDocuments(data)
    } catch {
      toast.error('Belgeler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    // Client-side ön kontrol — backend'e gitmeden hızlı feedback
    const MAX_SIZE = 15 * 1024 * 1024  // 15 MB (backend ile aynı)
    if (file.size > MAX_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      toast.error(`Dosya çok büyük (${mb} MB). Maksimum 15 MB olmalı.`)
      e.target.value = ''
      return
    }

    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'doc', 'docx']
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!allowed.includes(ext)) {
      toast.error(`'.${ext}' formatı desteklenmiyor. Kabul edilenler: PDF, JPG, PNG, WEBP, HEIC, DOC, DOCX`)
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      await hotelApi.uploadDocument(file, selectedType)
      toast.success('Belge yüklendi')
      fetchDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete(docId) {
    if (!confirm('Belge silinsin mi?')) return
    try {
      await hotelApi.deleteDocument(docId)
      toast.success('Belge silindi')
      fetchDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header"><h2 className="font-semibold text-slate-800">Belge Yükle</h2></div>
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
              className="input sm:w-52 flex-shrink-0">
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              border-2 border-dashed cursor-pointer text-sm font-medium transition-colors
              ${uploading ? 'border-violet-300 bg-violet-50 text-violet-400 cursor-wait'
                : 'border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-slate-600 hover:text-violet-600'}`}>
              <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,image/*,application/pdf"/>
              {uploading ? '⏳ Yükleniyor...' : '📎 Dosya Seç (PDF, JPG, PNG, WEBP, HEIC, DOC, max 15 MB)'}
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800">Belgelerim</h2>
          <span className="text-xs text-slate-400">{documents.length} belge</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-state py-10">
            <span className="text-4xl mb-3">📁</span>
            <p className="text-slate-500 text-sm">Henüz belge yüklenmedi</p>
          </div>
        ) : (
          <div className="table-container rounded-none border-0 border-t border-slate-100">
            <table className="table">
              <thead>
                <tr>
                  <th>Dosya Adı</th>
                  <th>Tür</th>
                  <th>Hassas</th>
                  <th className="hidden sm:table-cell">Tarih</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>📄</span>
                        <span className="font-medium text-slate-700 text-sm">{doc.originalFileName}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-reviewing">{doc.type}</span></td>
                    <td>
                      {doc.sensitive
                        ? <span className="text-amber-600 text-xs font-medium">🔒 Hassas</span>
                        : <span className="text-slate-400 text-xs">Açık</span>}
                    </td>
                    <td className="hidden sm:table-cell text-slate-400 text-xs">
                      {new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(doc.id)} className="btn-danger">Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Overview Tab ── */
function OverviewTab({ user, applications, onTabChange }) {
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length
  const pending   = applications.filter(a => a.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Başvuru',  value: applications.length, icon: '📋', color: 'from-blue-500 to-blue-600' },
          { label: 'Bekleyen', value: pending,              icon: '⏳', color: 'from-amber-500 to-amber-600' },
          { label: 'Kabul',    value: accepted,             icon: '✅', color: 'from-emerald-500 to-emerald-600' },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl mx-auto mb-2`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'İlanları Keşfet',  icon: '📌', tab: 'listings',     desc: 'Aktif iş ilanlarına göz at' },
          { label: 'Başvurularım',     icon: '📋', tab: 'applications', desc: 'Başvuru durumlarını takip et' },
          { label: 'Belgelerim',       icon: '📁', tab: 'documents',    desc: 'CV, transkript ve diğerleri' },
        ].map(action => (
          <button key={action.tab} onClick={() => onTabChange(action.tab)}
            className="card text-left p-5 hover:border-violet-200 hover:-translate-y-0.5 transition-all duration-200 w-full">
            <div className="text-2xl mb-3">{action.icon}</div>
            <div className="font-semibold text-slate-800 text-sm">{action.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
          </button>
        ))}
      </div>

      {/* Recent applications */}
      {applications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800">Son Başvurular</h2>
            <button onClick={() => onTabChange('applications')}
              className="text-xs font-medium" style={{ color: '#7c3aed' }}>Tümü →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {applications.slice(0, 3).map(app => (
              <div key={app.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">{app.listing?.title}</div>
                  <div className="text-xs text-slate-400">{app.listing?.businessName}</div>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Profile Tab ── */
function ProfileTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [profile, setProfile] = useState(null)  // readonly meta (email, role, isStudent)

  useEffect(() => {
    hotelApi.getCandidateProfile()
      .then(data => {
        setProfile(data)
        setForm({
          fullName:           data.fullName           || '',
          phone:              data.phone              || '',
          district:           data.district           || '',
          birthDate:          data.birthDate          || '',
          gender:             data.gender             || '',
          education:          data.education          || '',
          languages:          data.languages          || [],
          availabilityTypes:  data.availabilityTypes  || [],
          previousExperience: data.previousExperience || '',
          smokes:             data.smokes ?? null,
          hasLicense:         data.hasLicense ?? null,
        })
      })
      .catch(() => toast.error('Profil yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleSetField(field, value) {
    setForm(prev => {
      const has = prev[field].includes(value)
      return {
        ...prev,
        [field]: has ? prev[field].filter(x => x !== value) : [...prev[field], value],
      }
    })
  }

  function setTriState(field, raw) {
    setForm(prev => ({
      ...prev,
      [field]: raw === 'unknown' ? null : raw === 'yes',
    }))
  }

  const triValue = (v) => v === null || v === undefined ? 'unknown' : (v ? 'yes' : 'no')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName.trim()) return toast.error('Ad soyad zorunlu')

    setSaving(true)
    try {
      const payload = {
        fullName:           form.fullName.trim(),
        phone:              form.phone.trim() || null,
        district:           form.district || null,
        birthDate:          form.birthDate || null,
        gender:             form.gender || null,
        education:          form.education || null,
        languages:          form.languages,
        availabilityTypes:  form.availabilityTypes,
        previousExperience: form.previousExperience.trim() || null,
        smokes:             form.smokes,
        hasLicense:         form.hasLicense,
      }
      const data = await hotelApi.updateCandidateProfile(payload)
      setProfile(data)
      toast.success('Profil güncellendi!')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!form) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {/* Block 1: Temel Bilgiler */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Temel Bilgiler</h3>

        <div>
          <label className="label">Ad Soyad *</label>
          <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className="input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">E-posta <span className="text-slate-400 font-normal">(değiştirilemez)</span></label>
            <input type="email" value={profile?.email || ''} disabled
              className="input bg-slate-50 text-slate-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input type="text" name="phone" value={form.phone} onChange={handleChange}
              className="input" placeholder="05XX XXX XX XX" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">İlçe</label>
            <select name="district" value={form.district} onChange={handleChange} className="input">
              <option value="">Seçin</option>
              {ISTANBUL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Doğum Tarihi</label>
            <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="input" />
          </div>
          <div>
            <label className="label">Cinsiyet</label>
            <select name="gender" value={form.gender} onChange={handleChange} className="input">
              <option value="">Belirtmedim</option>
              {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Block 2: Eğitim */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Eğitim</h3>

        <div>
          <label className="label">Eğitim Durumu <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <select name="education" value={form.education} onChange={handleChange} className="input">
            <option value="">Seçin</option>
            {Object.entries(EDUCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Block 3: İş Tercihleri */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">İş Tercihleri</h3>

        <div>
          <label className="label">Müsaitlik Türü <span className="text-slate-400 font-normal">(birden fazla seçebilirsin)</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => {
              const active = form.availabilityTypes.includes(key)
              return (
                <button key={key} type="button" onClick={() => toggleSetField('availabilityTypes', key)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all
                    ${active
                      ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="label">Önceki Deneyim <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <textarea name="previousExperience" value={form.previousExperience} onChange={handleChange}
            className="input resize-none h-24 text-sm"
            placeholder="Daha önce çalıştığın yerler, pozisyonlar, kazandığın deneyimler..." />
        </div>
      </div>

      {/* Block 4: Diğer */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Diğer</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ehliyet</label>
            <select value={triValue(form.hasLicense)} onChange={e => setTriState('hasLicense', e.target.value)} className="input">
              <option value="unknown">Belirtmedim</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>
  )
}

/* ── Placeholder Tab ── */
function PlaceholderTab({ icon, title, desc }) {
  return (
    <div className="card">
      <div className="card-body empty-state py-16">
        <span className="text-5xl mb-4">{icon}</span>
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
      </div>
    </div>
  )
}

/* ── Main Dashboard ── */
export default function CandidateDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    try {
      const data = await hotelApi.getMyApplications()
      setApplications(data)
    } catch {
      // Fail silently on overview — errors shown per-tab
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview'      && <OverviewTab user={user} applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'listings'      && <ListingsPage onApplicationSubmitted={fetchApplications} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={fetchApplications} />}
          {activeTab === 'documents'     && <DocumentsTab />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
    </DashboardLayout>
  )
}
