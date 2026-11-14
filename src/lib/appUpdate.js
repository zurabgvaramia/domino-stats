let recordDirty = false
let updateReady = false
let refreshing = false
const listeners = new Set()

function bannerVisible() {
  return updateReady && recordDirty && !refreshing
}

function emit() {
  const show = bannerVisible()
  for (const listener of listeners) listener(show)
}

export function setRecordDirty(dirty) {
  recordDirty = Boolean(dirty)
  if (!recordDirty && updateReady) {
    reloadForUpdate()
    return
  }
  emit()
}

export function shouldHoldUpdate() {
  return recordDirty
}

export function holdUpdateForRecord() {
  updateReady = true
  emit()
}

export function applyPendingUpdate() {
  if (updateReady) reloadForUpdate()
}

export function subscribeUpdate(listener) {
  listeners.add(listener)
  listener(bannerVisible())
  return () => listeners.delete(listener)
}

export function reloadForUpdate() {
  if (refreshing) return
  refreshing = true
  window.location.reload()
}
