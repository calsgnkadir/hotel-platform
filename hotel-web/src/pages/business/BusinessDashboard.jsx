import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import MessagesPage from '../MessagesPage'
import { keys } from '../../lib/queryClient'

// FAZ 0/#9 — Tüm tab'lar ayrı dosyalarda
import OverviewTab from './tabs/OverviewTab'
import MyListingsTab from './tabs/MyListingsTab'
import ApplicationsTab from './tabs/ApplicationsTab'
import WorkersTab from './tabs/WorkersTab'
import ProfileTab from './tabs/ProfileTab'

export default function BusinessDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
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
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview'      && <OverviewTab applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'mylistings'    && <MyListingsTab />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'workers'       && <WorkersTab applications={applications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
    </DashboardLayout>
  )
}
