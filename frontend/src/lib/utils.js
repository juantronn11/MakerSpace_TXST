export function effectiveStatus(printer, now = new Date()) {
  if (
    printer.status === 'in_use' &&
    printer.estimatedFinish &&
    printer.estimatedFinish < now
  ) {
    return 'likely'
  }
  return printer.status
}

export function timeInfo(printer, now = new Date()) {
  const eff = effectiveStatus(printer, now)
  if (eff === 'available')   return '✓ Ready to use'
  if (eff === 'likely')      return '⏰ Print time elapsed — may be free'
  if (eff === 'maintenance') return '⚠ Down for maintenance'
  if (eff === 'in_use' && printer.estimatedFinish) {
    const ms = printer.estimatedFinish - now
    if (ms <= 0) return '⏰ Print time elapsed — may be free'
    return '⏱ ' + formatCountdown(ms)
  }
  return '⏱ In use — finish time unknown'
}

export function formatCountdown(ms) {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m remaining`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} remaining`
}

export function timeAgo(date) {
  const s = (Date.now() - date) / 1000
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function statsFrom(printers) {
  const now = new Date()
  let available = 0, inUse = 0, maintenance = 0
  for (const p of printers) {
    const s = effectiveStatus(p, now)
    if (s === 'available') available++
    else if (s === 'in_use' || s === 'likely') inUse++
    else if (s === 'maintenance') maintenance++
  }
  return { available, inUse, maintenance }
}
