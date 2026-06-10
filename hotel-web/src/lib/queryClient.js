import { QueryClient } from '@tanstack/react-query'

/**
 * F0.10 — Merkezi QueryClient.
 *
 * Default ayarlar:
 *  - staleTime: 30sn (yeni veri 30sn taze sayılır, refetch tetiklenmez)
 *  - gcTime: 5dk (kullanılmayan veri 5dk sonra silinir)
 *  - retry: 1 kez (network hatasında otomatik 1 retry)
 *  - refetchOnWindowFocus: false (tab değişiminde otomatik refetch kapalı)
 *
 * Bireysel hook'larda override edilir (örn mesaj polling: refetchInterval).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

/**
 * Merkezi queryKey hiyerarşisi.
 * invalidation kolaylığı için: keys.applications.all → tüm başvuru cache invalid
 */
export const keys = {
  conversations: {
    all: ['conversations'],
    list: () => [...keys.conversations.all, 'list'],
    messages: (conversationId) => [...keys.conversations.all, conversationId, 'messages'],
    unreadCount: () => ['conversations', 'unread-count'],
  },
  notifications: {
    all: ['notifications'],
    list: (page, size) => [...keys.notifications.all, 'list', page, size],
    unreadCount: () => [...keys.notifications.all, 'unread-count'],
  },
  applications: {
    all: ['applications'],
    candidate: () => [...keys.applications.all, 'candidate'],
    business: () => [...keys.applications.all, 'business'],
  },
  listings: {
    all: ['listings'],
    list: (filters) => [...keys.listings.all, 'list', filters],
    detail: (id) => [...keys.listings.all, 'detail', id],
  },
  documents: {
    all: ['documents'],
    my: () => [...keys.documents.all, 'my'],
  },
  reviews: {
    all: ['reviews'],
    listing: (listingId) => [...keys.reviews.all, 'listing', listingId],
  },
  stats: {
    all: ['stats'],
    business: () => [...keys.stats.all, 'business'],
    candidate: () => [...keys.stats.all, 'candidate'],
  },
}
