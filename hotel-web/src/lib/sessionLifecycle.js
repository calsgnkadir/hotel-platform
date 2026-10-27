// A session boundary invalidates work started by the previous signed-in account,
// even when the next login belongs to the same user. Refreshing a token is not a
// boundary: requests already in flight for that account may still finish.
let revision = 0
const listeners = new Set()
let pendingLogout = null

function storedIdentity() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    const id = user?.userId ?? user?.id
    return id == null ? null : String(id)
  } catch {
    return null
  }
}

export function getSessionSnapshot() {
  return { revision, identity: storedIdentity() }
}

export function isSessionCurrent(snapshot) {
  return !!snapshot && snapshot.revision === revision && snapshot.identity === storedIdentity()
}

export function advanceSessionRevision() {
  revision += 1
  // Offline drafts belong to the retired account, never the next browser user.
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('kadrom.offline-queue.')) sessionStorage.removeItem(key)
    }
  } catch { /* storage can be unavailable */ }
  for (const listener of listeners) {
    try { listener() } catch { /* One cleanup must not block the other session guards. */ }
  }
  return revision
}

export function onSessionBoundary(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Do not let a delayed logout response erase a new login's refresh cookie.
export function trackLogout(task) {
  pendingLogout = task
  const done = () => { if (pendingLogout === task) pendingLogout = null }
  task.then(done, done)
}

export async function waitForPendingLogout() {
  if (pendingLogout) await pendingLogout.catch(() => {})
}
