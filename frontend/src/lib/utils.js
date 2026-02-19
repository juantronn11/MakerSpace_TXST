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
    const ms   = printer.estimatedFinish - now
    const mins = Math.ceil(ms / 60000)
    return mins > 60
      ? `⏱ ~${(ms / 3600000).toFixed(1)}h remaining`
      : `⏱ ~${mins} min remaining`
  }
  return '⏱ In use — finish time unknown'
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
