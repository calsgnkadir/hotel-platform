import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import MessagesPage from '../MessagesPage'
import { keys } from '../../lib/queryClient'
import { SkeletonList } from '../../components/Skeleton'
import { useAuth } from '../../context/AuthContext'
import OnboardingWizard, { shouldShowOnboarding } from '../../components/OnboardingWizard'

// FAZ 0/#9 — Tüm tab'lar ayrı dosyalarda
import OverviewTab from './tabs/OverviewTab'
import MyListingsTab from './tabs/MyListingsTab'
import ApplicationsTab from './tabs/ApplicationsTab'
import WorkersTab from './tabs/WorkersTab'
import FavoritesTab from './tabs/FavoritesTab'  // FAZ 2/#32
import ProfileTab from './tabs/ProfileTab'
import BillingTab from './tabs/BillingTab'

const VALID_TABS = ['overview','mylistings','applications','workers','favorites','billing','profile','messages']
// Bildirim/push linklerinde gecen eski sekme adlari (backend "listings" gonderiyor)
const TAB_ALIASES = { listings: 'mylistings' }
const resolveTab = (t) => {
  const r = TAB_ALIASES[t] || t
  return VALID_TABS.includes(r) ? r : null
}

export default function BusinessDashboard() {
  const [params, setParams] = useSearchParams()
  // FAZ 5.3 — CommandPalette ?tab=… ile derin link
  const initialTab = resolveTab(params.get('tab')) || 'overview'
  const [activeTab, _setActiveTab] = useState(initialTab)
  const { user } = useAuth()

  useEffect(() => {
    const t = resolveTab(params.get('tab'))
    if (t && t !== activeTab) _setActiveTab(t)
  }, [params])

  /**
   * FAZ 19 — extra: sekmeyle BIRLIKTE tasinacak query param'lar
   * (orn. ?tab=applications&status=ACCEPTED derin linki).
   * setParams tum param'lari ezdigi icin tek cagride verilmeli — once sekme
   * degistirip sonra status yazmak ilkini silerdi.
   */
  function setActiveTab(t, extra) {
    // Gecersiz id (or. bildirimden gelen bilinmeyen sekme) reddedilir: bos ekran olmasin
    const tab = resolveTab(t)
    if (!tab) return false
    _setActiveTab(tab)
    setParams({ tab, ...(extra || {}) }, { replace: true })
    return true
  }

  // Sohbet derin linki: ?tab=messages&c={conversationId} — MessagesPage c'yi okuyup sohbeti secer
  function openMessages(conversationId) {
    setActiveTab('messages', conversationId ? { c: String(conversationId) } : undefined)
  }

  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding(user?.id))
  const queryClient = useQueryClient()

  // FAZ 0/#10 (Aşama 4) — useQuery: cache + auto-refetch + invalidation
  const { data, isLoading, error } = useQuery({
    queryKey: keys.applications.business(),
    queryFn: async () => {
      const res = await hotelApi.getBusinessApplications({ size: 1000 })
      return Array.isArray(res) ? res : (res?.content ?? [])
    },
  })

  if (error) toast.error('Başvurular yüklenemedi')
  const applications = data ?? []

  // Tab'ların mutation sonrası çağırması için tek noktadan invalidate
  const refetchApplications = () =>
    queryClient.invalidateQueries({ queryKey: keys.applications.business() })

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {isLoading ? (
        <SkeletonList count={5} />
      ) : (
        /* FAZ 5.4 — CSS-based tab transition (Framer key remount tetiklenmiyordu) */
        <div key={activeTab} className="page-enter">
          {activeTab === 'overview'      && <OverviewTab applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'mylistings'    && <MyListingsTab applications={applications} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={openMessages} />}
          {activeTab === 'workers'       && <WorkersTab applications={applications} onOpenMessages={openMessages} />}
          {activeTab === 'favorites'     && <FavoritesTab onOpenMessages={openMessages} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'billing'       && <BillingTab />}
          {activeTab === 'profile'       && <ProfileTab />}
        </div>
      )}
      {showOnboarding && (
        <OnboardingWizard user={user} onClose={() => setShowOnboarding(false)} onTabChange={setActiveTab} />
      )}
    </DashboardLayout>
  )
}
