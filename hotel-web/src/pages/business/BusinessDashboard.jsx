import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import MessagesPage from '../MessagesPage'
import { keys } from '../../lib/queryClient'
import { SkeletonList } from '../../components/Skeleton'
import LoadError from '../../components/ui/LoadError'
import { useAuth } from '../../context/AuthContext'
import OnboardingWizard, { shouldShowOnboarding } from '../../components/OnboardingWizard'
import { ROLE, resolveTab as resolveNavTab, defaultTabFor } from '../../lib/navigation'

import OverviewTab from './tabs/OverviewTab'
import MyListingsTab from './tabs/MyListingsTab'
import ApplicationsTab from './tabs/ApplicationsTab'
import TeamTab from './tabs/TeamTab'
import ProfileTab from './tabs/ProfileTab'
import BillingTab from './tabs/BillingTab'

/**
 * Sekme çözümü lib/navigation.js'ten: geçerli sekmeler + eski adlar
 * ("listings" → İlanlarım, "workers"/"favorites" → Ekibim'in ilgili görünümü).
 */
const resolve = (t) => resolveNavTab(ROLE.BUSINESS, t)

export default function BusinessDashboard() {
  const [params, setParams] = useSearchParams()
  const initial = resolve(params.get('tab'))
  const [activeTab, _setActiveTab] = useState(initial?.tab || defaultTabFor(ROLE.BUSINESS))
  const { user } = useAuth()

  // URL değişince (komut paleti, bildirim, eski derin link) sekmeyi eşitle.
  // Eski ad geldiyse adres yeni biçime yazılır (?tab=workers → ?tab=team&view=workers).
  useEffect(() => {
    const r = resolve(params.get('tab'))
    if (!r) return
    if (r.tab !== activeTab) _setActiveTab(r.tab)
    if (r.aliased) {
      const next = new URLSearchParams(params)
      next.set('tab', r.tab)
      Object.entries(r.params || {}).forEach(([k, v]) => next.set(k, v))
      setParams(next, { replace: true })
    }
  }, [params])

  /**
   * extra: sekmeyle BİRLİKTE taşınacak query parametreleri
   * (ör. ?tab=applications&status=PENDING derin linki). setParams tüm
   * parametreleri ezdiği için tek çağrıda verilir.
   */
  function setActiveTab(t, extra) {
    // Geçersiz id (ör. bildirimden gelen bilinmeyen sekme) reddedilir: boş ekran olmasın
    const r = resolve(t)
    if (!r) return false
    _setActiveTab(r.tab)
    setParams({ tab: r.tab, ...(r.params || {}), ...(extra || {}) }, { replace: true })
    return true
  }

  // Sohbet derin linki: ?tab=messages&c={conversationId}
  function openMessages(conversationId) {
    setActiveTab('messages', conversationId ? { c: String(conversationId) } : undefined)
  }

  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding(user?.id))
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: keys.applications.business(),
    queryFn: async () => {
      const res = await hotelApi.getBusinessApplications({ size: 1000 })
      return Array.isArray(res) ? res : (res?.content ?? [])
    },
  })
  const applications = data ?? []

  // Sekmelerin mutation sonrası çağırması için tek noktadan invalidate
  const refetchApplications = () =>
    queryClient.invalidateQueries({ queryKey: keys.applications.business() })

  // Başvurulara bağlı sekmeler; İlanlarım/Abonelik/Profil/Mesajlar kendi verisini yükler
  const needsApplications = ['overview', 'applications', 'team', 'mylistings'].includes(activeTab)
  const appsFailed = !!error && !data

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {isLoading && needsApplications ? (
        <SkeletonList count={5} />
      ) : appsFailed && needsApplications && activeTab !== 'mylistings' ? (
        <LoadError message="Başvurular yüklenemedi." onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <div key={activeTab} className="page-enter">
          {activeTab === 'overview'      && <OverviewTab applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'mylistings'    && <MyListingsTab applications={applications} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={openMessages} />}
          {activeTab === 'team'          && <TeamTab applications={applications} onOpenMessages={openMessages} />}
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
