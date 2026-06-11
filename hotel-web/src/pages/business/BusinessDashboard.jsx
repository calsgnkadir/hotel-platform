import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import MessagesPage from '../MessagesPage'

// FAZ 0/#9 — Tüm tab'lar ayrı dosyalarda (5 tab + 1 messages):
import OverviewTab from './tabs/OverviewTab'
import MyListingsTab from './tabs/MyListingsTab'
import ApplicationsTab from './tabs/ApplicationsTab'
import WorkersTab from './tabs/WorkersTab'
import ProfileTab from './tabs/ProfileTab'

export default function BusinessDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    try {
      // #84: PageResponse — overview stats için tümü gerek, listede ayrıca sayfalanır
      const data = await hotelApi.getBusinessApplications({ size: 1000 })
      setApplications(Array.isArray(data) ? data : (data?.content ?? []))
    } catch {
      toast.error('Başvurular yüklenemedi')
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
          {activeTab === 'overview'      && <OverviewTab applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'mylistings'    && <MyListingsTab />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={fetchApplications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'workers'       && <WorkersTab applications={applications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
    </DashboardLayout>
  )
}
