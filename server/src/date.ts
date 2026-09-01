export function getBeijingDate(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 8 * 3600000)
}

export function getBeijingDateStr(): string {
  const d = getBeijingDate()
  return d.toISOString().slice(0, 10)
}

export function getBeijingYesterdayStr(): string {
  const d = getBeijingDate()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
