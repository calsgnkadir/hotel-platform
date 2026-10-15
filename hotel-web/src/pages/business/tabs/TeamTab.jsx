/**
 * Ekibim — işletmenin aday ilişkileri tek sekmede, segmentli:
 *   Bizde çalışanlar (WorkersTab) · Favoriler · Engellenenler (FavoritesTab)
 *
 * Görünüm URL'de tutulur (?tab=team&view=workers|favorites|blocked); eski
 * ?tab=workers / ?tab=favorites derin linkleri BusinessDashboard'da buraya
 * yönlendirilir (lib/navigation.js TAB_ALIASES).
 */
import { useSearchParams } from 'react-router-dom'
import WorkersTab from './WorkersTab'
import FavoritesTab from './FavoritesTab'

export const TEAM_VIEWS = [
  { id: 'workers',   label: 'Bizde çalışanlar' },
  { id: 'favorites', label: 'Favoriler' },
  { id: 'blocked',   label: 'Engellenenler' },
]
const VIEW_IDS = TEAM_VIEWS.map(v => v.id)

export default function TeamTab({ applications = [], onOpenMessages }) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const view = VIEW_IDS.includes(raw) ? raw : 'workers'

  function choose(id) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'team')
      next.set('view', id)
      return next
    }, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="ah-segment" role="tablist" aria-label="Ekibim görünümü">
        {TEAM_VIEWS.map(v => {
          const active = view === v.id
          return (
            <button key={v.id} type="button" role="tab"
                    id={`team-tab-${v.id}`}
                    aria-selected={active}
                    aria-controls="team-panel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => choose(v.id)}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                      e.preventDefault()
                      const i = VIEW_IDS.indexOf(view)
                      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + VIEW_IDS.length) % VIEW_IDS.length
                      choose(VIEW_IDS[n])
                      document.getElementById(`team-tab-${VIEW_IDS[n]}`)?.focus()
                    }}
                    className={`ah-segment__item${active ? ' is-active' : ''}`}>
              {v.label}
            </button>
          )
        })}
      </div>

      <div id="team-panel" role="tabpanel" aria-labelledby={`team-tab-${view}`}>
        {view === 'workers'
          ? <WorkersTab applications={applications} onOpenMessages={onOpenMessages} />
          : <FavoritesTab onOpenMessages={onOpenMessages} segment={view} />}
      </div>
    </div>
  )
}
