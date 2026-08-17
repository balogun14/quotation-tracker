export const STAGES = ['Sent', 'Followed Up', 'Booked', 'Lost']

export const STATUS_META = {
  Sent: { className: 'sent', label: 'Sent' },
  'Followed Up': { className: 'followed', label: 'Followed up' },
  Booked: { className: 'booked', label: 'Booked' },
  Lost: { className: 'lost', label: 'Lost' },
}

export const money = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

export const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export const initialQuotes = [
  { id: 1, client: 'Amina Bello', company: 'BrightPath Events', email: 'amina@brightpath.co', phone: '+234 803 112 2450', service: 'Event furniture hire', value: 485000, sent: '12 Aug 2026', followUp: 'Today', status: 'Sent' },
  { id: 2, client: 'Chioma Okafor', company: 'Lagos Food Co.', email: 'chioma@lagosfood.co', phone: '+234 805 774 9021', service: 'Office equipment hire', value: 320000, sent: '08 Aug 2026', followUp: 'Overdue', status: 'Followed Up' },
  { id: 3, client: 'Tobi Adeyemi', company: 'Cedar Homes', email: 'tobi@cedarhomes.ng', phone: '+234 812 400 8816', service: 'Short-let furnishing', value: 760000, sent: '03 Aug 2026', followUp: '16 Aug', status: 'Followed Up' },
  { id: 4, client: 'Ijeoma Nwosu', company: 'Nwosu & Partners', email: 'ijeoma@nwosupartners.com', phone: '+234 901 556 3304', service: 'Meeting room setup', value: 215000, sent: '01 Aug 2026', followUp: 'Completed', status: 'Booked' },
  { id: 5, client: 'Dami Oke', company: 'Aster Studios', email: 'dami@asterstudios.ng', phone: '+234 806 229 7710', service: 'Production equipment', value: 180000, sent: '29 Jul 2026', followUp: 'Closed', status: 'Lost' },
  { id: 6, client: 'Folake Ajayi', company: 'Glow Beauty Studio', email: 'folake@glowbeauty.ng', phone: '+234 813 660 1198', service: 'Salon furniture set', value: 265000, sent: '14 Aug 2026', followUp: 'Today', status: 'Sent' },
  { id: 7, client: 'Emeka Obi', company: 'Horizon Logistics', email: 'emeka@horizonlogi.ng', phone: '+234 808 910 4462', service: 'Warehouse shelving', value: 540000, sent: '14 Aug 2026', followUp: 'Tomorrow', status: 'Sent' },
  { id: 8, client: 'Zainab Musa', company: 'Kano Weddings', email: 'zainab@kanoweddings.ng', phone: '+234 902 335 8870', service: 'Marquee + seating', value: 890000, sent: '06 Aug 2026', followUp: '19 Aug', status: 'Followed Up' },
  { id: 9, client: 'Peter Nwankwo', company: 'Skyline Apartments', email: 'peter@skylineapts.ng', phone: '+234 810 447 2251', service: 'Guest lounge setup', value: 410000, sent: '31 Jul 2026', followUp: 'Completed', status: 'Booked' },
  { id: 10, client: 'Grace Adeleke', company: 'Aurora Media', email: 'grace@auroramedia.ng', phone: '+234 907 188 6643', service: 'Podcast studio gear', value: 230000, sent: '27 Jul 2026', followUp: 'Closed', status: 'Lost' },
]

const LS_QUOTES = 'quotely.quotes'

export function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return initialQuotes
}

export function saveQuotes(quotes) {
  try {
    localStorage.setItem(LS_QUOTES, JSON.stringify(quotes))
  } catch {
    /* ignore */
  }
}
