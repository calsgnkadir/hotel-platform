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

const VALID_TABS = ['overview','mylistings','applications','workers','favorites','profile','messages']

export default function BusinessDashboard() {
  const [params, setParams] = useSearchParams()
  // FAZ 5.3 — CommandPalette ?tab=… ile derin link
  const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'overview'
  const [activeTab, _setActiveTab] = useState(initialTab)
  const { user } = useAuth()

  useEffect(() => {
    const t = params.get('tab')
    if (t && VALID_TABS.includes(t) && t !== activeTab) _setActiveTab(t)
  }, [params])

  function setActiveTab(t) {
    _setActiveTab(t)
    setParams({ tab: t }, { replace: true })
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
        /* FAZ 5.4 — page transition art Framer'a devredildi (DashboardLayout) */
        <div>
          {activeTab === 'overview'      && <OverviewTab applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'mylistings'    && <MyListingsTab />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'workers'       && <WorkersTab applications={applications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'favorites'     && <FavoritesTab onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
        </div>
      )}
      {showOnboarding && (
        <OnboardingWizard user={user} onClose={() => setShowOnboarding(false)} onTabChange={setActiveTab} />
      )}
    </DashboardLayout>
  )
}
