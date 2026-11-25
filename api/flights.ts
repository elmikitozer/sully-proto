// Mock flight API (Vercel Function). GET /api/flights or /api/flights?code=SL1204
// Boarding times are relative to the request time so the demo always shows
// upcoming flights. All data is fictional.
import { flights } from '../src/flights-data.js'

const STATUS = ['on_time', 'on_time', 'on_time', 'boarding_soon', 'on_time'] as const

export function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')?.replace(/\s+/g, '').toUpperCase()
  const now = Date.now()
  const list = flights
    .filter((f) => !code || f.code.replace(/\s+/g, '') === code)
    .map((f, i) => ({
      code: f.code, airline: f.airline, destination: f.city.en, iata: f.iata, terminal: f.terminal, gate: f.gate, schengen: !f.nonSchengen,
      boardingAt: new Date(now + f.boardInMin * 60000).toISOString(),
      status: f.boardInMin <= 40 ? 'boarding_soon' : STATUS[i % STATUS.length],
    }))
  if (code && !list.length) return Response.json({ error: 'flight_not_found', demo: true }, { status: 404 })
  return Response.json({ demo: true, updatedAt: new Date(now).toISOString(), flights: list }, { headers: { 'cache-control': 'no-store' } })
}
