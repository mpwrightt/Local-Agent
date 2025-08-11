const pending = new Map<string, (v: boolean) => void>()

export function keyFor(runId: string, taskId: string): string {
  return `${runId}:${taskId}`
}

export function requestConfirmation(runId: string, taskId: string): Promise<boolean> {
  const k = keyFor(runId, taskId)
  return new Promise<boolean>((resolve) => {
    pending.set(k, resolve)
    // Timeout auto-cancel after 90s
    setTimeout(() => {
      if (pending.has(k)) {
        pending.get(k)?.(false)
        pending.delete(k)
      }
    }, 90_000)
  })
}

export function resolveConfirmation(runId: string, taskId: string, confirmed: boolean) {
  const k = keyFor(runId, taskId)
  const fn = pending.get(k)
  if (fn) {
    fn(confirmed)
    pending.delete(k)
  }
}


