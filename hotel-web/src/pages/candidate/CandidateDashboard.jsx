// FAZ 5.2 — God class refactor.
// Eski: 1334 satir tek dosya. Yeni: layout-only + tab componentleri ayri.
//   tabs/ApplicationsTab.jsx
//   tabs/HistoryTab.jsx
//   tabs/ProfileTab.jsx
//   components/candidate/StatusBadge.jsx
//   utils/shifts.js + utils/labels.js
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import { keys } from '../../lib/queryClient'
import { SkeletonList } from '../../components/Skeleton'
import LoadError from '../../components/ui/LoadError'
import { ROLE, validTabsFor, defaultTabFor } from '../../lib/navigation'
import OnboardingWizard, { shouldShowOnboarding } from '../../components/OnboardingWizard'
import EntryPasses from '../../components/candidate/EntryPasses'  // vardiya günü giriş kartı
import ExitPasses from '../../components/candidate/ExitPasses'

import ListingsPage from './ListingsPage'
import MessagesPage from '../MessagesPage'
import ApplicationsTab from './tabs/ApplicationsTab'
import HistoryTab from './tabs/HistoryTab'
import ProfileTab from './tabs/ProfileTab'
import SavedListingsTab from './tabs/SavedListingsTab'  // Dalga H1
import RelationsTab from './tabs/RelationsTab'              // Dalga I1

// Geçerli sekmeler tek kaynaktan (lib/navigation.js); varsayılan 'listings'.
const VALID_TABS = validTabsFor(ROLE.CANDIDATE)
const DEFAULT_TAB = defaultTabFor(ROLE.CANDIDATE)

export default function CandidateDashboard() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  // FAZ 5.3 — Command Palette ?tab=… ile yonlendirme yapabilir; URL acanin tab'ini al.
  const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : DEFAULT_TAB
  const [activeTab, _setActiveTab] = useState(initialTab)
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding(user?.id))
  const [sessionRevision, setSessionRevision] = useState(0)
  const refreshSessionState = useCallback(() => setSessionRevision(n => n + 1), [])
  const queryClient = useQueryClient()

  // URL query degisirse activeTab sync et (CommandPalette navigate sonrasi)
  useEffect(() => {
    const t = params.get('tab')
    if (t && VALID_TABS.includes(t) && t !== activeTab) {
      _setActiveTab(t)
    }
  }, [params])

  // activeTab kullanici sidebar/setting menusunden degisirse URL'e de yaz.
  // Gecersiz id (or. bildirimden gelen bilinmeyen sekme) reddedilir: bos ekran olmasin.
  // extra: sekmeyle BIRLIKTE yazilacak query param'lar (or. sohbet derin linki ?c=).
  function handleTabChange(t, extra) {
    if (!VALID_TABS.includes(t)) return false
    _setActiveTab(t)
    setParams({ tab: t, ...(extra || {}) }, { replace: true })
    return true
  }

  // Sohbet derin linki: ?tab=messages&c={conversationId} — MessagesPage c'yi okuyup sohbeti secer
  function openMessages(conversationId) {
    handleTabChange('messages', conversationId ? { c: String(conversationId) } : undefined)
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: keys.applications.candidate(),
    queryFn: async () => {
      const res = await hotelApi.getMyApplications()
      return Array.isArray(res) ? res : (res?.content ?? [])
    },
  })
  const applications = data ?? []
  // Başvuru listesine bağlı sekmelerde yükleme hatası kart olarak gösterilir
  // (İlanlar/Kaydettiklerim/Profil kendi verisini yükler, engellenmez).
  const needsApplications = activeTab === 'applications' || activeTab === 'history'
  const appsFailed = !!error && !data

  const refetchApplications = () =>
    queryClient.invalidateQueries({ queryKey: keys.applications.candidate() })

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {isLoading && needsApplications ? (
        <SkeletonList count={4} />
      ) : appsFailed && needsApplications ? (
        <LoadError message="Başvuruların yüklenemedi." onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        /* FAZ 5.4 — CSS-based tab transition (Framer key remount tetiklenmiyordu) */
        <div key={activeTab} className="page-enter">
          {/* Vardiya günü: kapıda okutulacak kişisel giriş kartı (sohbet ekranı hariç) */}
          {activeTab !== 'messages' && <EntryPasses />}
          {activeTab !== 'messages' && <ExitPasses onSessionChange={refreshSessionState} />}
          {activeTab === 'listings'      && <ListingsPage onApplicationSubmitted={refetchApplications} onMessagesOpen={openMessages} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={openMessages} onTabChange={handleTabChange} sessionRevision={sessionRevision} />}
          {activeTab === 'history'       && <HistoryTab applications={applications} onOpenMessages={openMessages} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
          {activeTab === 'saved'         && <SavedListingsTab onTabChange={handleTabChange} />}
          {activeTab === 'relations'     && <RelationsTab onTabChange={handleTabChange} />}
        </div>
      )}
      {showOnboarding && (
        <OnboardingWizard user={user} onClose={() => setShowOnboarding(false)} onTabChange={handleTabChange} />
      )}
    </DashboardLayout>
  )
}

