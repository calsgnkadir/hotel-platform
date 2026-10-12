// FAZ 5.2 — God class refactor.
// Eski: 1334 satir tek dosya. Yeni: layout-only + tab componentleri ayri.
//   tabs/ApplicationsTab.jsx
//   tabs/HistoryTab.jsx
//   tabs/ProfileTab.jsx
//   components/candidate/StatusBadge.jsx
//   utils/shifts.js + utils/labels.js
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import { keys } from '../../lib/queryClient'
import { SkeletonList } from '../../components/Skeleton'
import OnboardingWizard, { shouldShowOnboarding } from '../../components/OnboardingWizard'
import EntryPasses from '../../components/candidate/EntryPasses'  // vardiya günü giriş kartı

import ListingsPage from './ListingsPage'
import MessagesPage from '../MessagesPage'
import ApplicationsTab from './tabs/ApplicationsTab'
import HistoryTab from './tabs/HistoryTab'
import ProfileTab from './tabs/ProfileTab'
import SavedListingsTab from './tabs/SavedListingsTab'  // Dalga H1
import RelationsTab from './tabs/RelationsTab'              // Dalga I1

// FAZ 26 — 'overview' (Genel Bakis) tamamen kaldirildi; varsayilan sekme 'listings'.
const VALID_TABS = ['listings','saved','relations','applications','history','messages','profile']

export default function CandidateDashboard() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  // FAZ 5.3 — Command Palette ?tab=… ile yonlendirme yapabilir; URL acanin tab'ini al.
  const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'listings'
  const [activeTab, _setActiveTab] = useState(initialTab)
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding(user?.id))
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

  const { data, isLoading } = useQuery({
    queryKey: keys.applications.candidate(),
    queryFn: async () => {
      const res = await hotelApi.getMyApplications()
      return Array.isArray(res) ? res : (res?.content ?? [])
    },
  })
  const applications = data ?? []

  const refetchApplications = () =>
    queryClient.invalidateQueries({ queryKey: keys.applications.candidate() })

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {isLoading ? (
        <SkeletonList count={4} />
      ) : (
        /* FAZ 5.4 — CSS-based tab transition (Framer key remount tetiklenmiyordu) */
        <div key={activeTab} className="page-enter">
          {/* Vardiya günü: kapıda okutulacak kişisel giriş kartı (sohbet ekranı hariç) */}
          {activeTab !== 'messages' && <EntryPasses />}
          {activeTab === 'listings'      && <ListingsPage onApplicationSubmitted={refetchApplications} onMessagesOpen={openMessages} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={openMessages} onTabChange={handleTabChange} />}
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

