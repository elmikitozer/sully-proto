// Real photo of a named shop or food outlet, from Google Places (New).
// GET /api/photo?id=a123  ->  { url, by }   (id = a place of our own list, see tools/build_pois.py)
// Needs the GOOGLE_PLACES_KEY environment variable. Without it, answers 404 and the app
// falls back to its illustration. Only places from our own list can be looked up, so the
// key cannot be used as an open proxy.
import { PHOTO_PLACES } from '../src/photo-places.js'

interface Photo { name: string; authorAttributions?: { displayName?: string }[] }
const none = (why: string, status = 404) => Response.json({ error: why }, { status, headers: { 'cache-control': 'no-store' } })

export async function GET(request: Request) {
  const key = process.env.GOOGLE_PLACES_KEY
  const place = PHOTO_PLACES[new URL(request.url).searchParams.get('id') ?? '']
  if (!place) return none('unknown_place')
  if (!key) return none('no_key')
  try {
    const search = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key, 'x-goog-fieldmask': 'places.id,places.location,places.photos' },
      body: JSON.stringify({
        textQuery: `${place.n} Aéroport Paris-Orly`,
        maxResultCount: 1,
        // Prefer the outlet at this exact spot: Orly has several Paul, Relay and Starbucks.
        locationBias: { circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 150 } },
      }),
    })
    if (!search.ok) return none('search_failed', 502)
    const hit = ((await search.json()) as { places?: { location?: { latitude: number; longitude: number }; photos?: Photo[] }[] }).places?.[0]
    // Only accept a result inside the airport: a "Paul" 20 km away is not this Paul.
    const at = hit?.location
    if (!at || at.latitude < 48.7205 || at.latitude > 48.7365 || at.longitude < 2.351 || at.longitude > 2.384) return none('not_at_orly')
    const photo = hit.photos?.[0]
    if (!photo) return none('no_photo')
    const media = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`, { headers: { 'x-goog-api-key': key } })
    if (!media.ok) return none('photo_failed', 502)
    const { photoUri } = (await media.json()) as { photoUri?: string }
    if (!photoUri) return none('no_photo')
    // Short shared cache: keeps the demo fast and the Google bill near zero.
    return Response.json({ url: photoUri, by: photo.authorAttributions?.[0]?.displayName ?? null }, { headers: { 'cache-control': 'public, s-maxage=3600, max-age=600' } })
  } catch {
    return none('upstream_error', 502)
  }
}
