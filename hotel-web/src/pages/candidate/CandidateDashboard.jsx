// FAZ 5.2 — God class refactor.
// Eski: 1334 satir tek dosya. Yeni: layout-only + tab componentleri ayri.
//   tabs/OverviewTab.jsx
//   tabs/ApplicationsTab.jsx
//   tabs/HistoryTab.jsx
//   tabs/DocumentsTab.jsx
//   tabs/ProfileTab.jsx
//   components/candidate/StatusBadge.jsx
//   components/candidate/EarningsWidget.jsx
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

import ListingsPage from './ListingsPage'
import MessagesPage from '../MessagesPage'
import OverviewTab from './tabs/OverviewTab'
import ApplicationsTab from './tabs/ApplicationsTab'
import HistoryTab from './tabs/HistoryTab'
import DocumentsTab from './tabs/DocumentsTab'
import ProfileTab from './tabs/ProfileTab'

const VALID_TABS = ['overview','listings','applications','history','documents','messages','profile']

export default function CandidateDashboard() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  // FAZ 5.3 — Command Palette ?tab=… ile yonlendirme yapabilir; URL acanin tab'ini al.
  const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'overview'
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

  // activeTab kullanici sidebar/setting menusunden degisirse URL'e de yaz
  function handleTabChange(t) {
    _setActiveTab(t)
    setParams({ tab: t }, { replace: true })
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
        /* FAZ 3 — Tab degisiminde sade fade-in */
        <div key={activeTab} className="page-enter">
          {activeTab === 'overview'      && <OverviewTab user={user} applications={applications} onTabChange={handleTabChange} />}
          {activeTab === 'listings'      && <ListingsPage onApplicationSubmitted={refetchApplications} onMessagesOpen={() => handleTabChange('messages')} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={() => handleTabChange('messages')} onTabChange={handleTabChange} />}
          {activeTab === 'history'       && <HistoryTab applications={applications} onOpenMessages={() => handleTabChange('messages')} />}
          {activeTab === 'documents'     && <DocumentsTab />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
        </div>
      )}
      {showOnboarding && (
        <OnboardingWizard user={user} onClose={() => setShowOnboarding(false)} onTabChange={handleTabChange} />
      )}
    </DashboardLayout>
  )
}

