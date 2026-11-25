// Demo flights. Shared by the app and the mock API (api/flights.ts).
// Everything here is made up: airline, codes, gates, boarding times.
export interface Flight { code: string; airline: string; city: { fr: string; en: string }; iata: string; terminal: string; gate: string; boardInMin: number }

export const flights: Flight[] = [
  { code: 'SL 1204', airline: 'Sully Air', city: { fr: 'Barcelone', en: 'Barcelona' }, iata: 'BCN', terminal: 'Orly 4', gate: '57', boardInMin: 70 },
  { code: 'SL 3310', airline: 'Sully Air', city: { fr: 'Nice', en: 'Nice' }, iata: 'NCE', terminal: 'Orly 2', gate: '24', boardInMin: 55 },
  { code: 'SL 0815', airline: 'Sully Air', city: { fr: 'Lisbonne', en: 'Lisbon' }, iata: 'LIS', terminal: 'Orly 3', gate: '35', boardInMin: 45 },
  { code: 'SL 2077', airline: 'Sully Air', city: { fr: 'Marrakech', en: 'Marrakesh' }, iata: 'RAK', terminal: 'Orly 1', gate: '14', boardInMin: 90 },
  { code: 'SL 0412', airline: 'Sully Air', city: { fr: 'Rome', en: 'Rome' }, iata: 'FCO', terminal: 'Orly 4', gate: '68', boardInMin: 35 },
]
