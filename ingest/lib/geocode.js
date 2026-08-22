// Coordinates → city name, via OpenStreetMap's Nominatim.
//
// Deliberately a separate step from the import: geocoding is a network call
// against a rate-limited public service, and it has no business making a
// video encode fail. Imports store latitude/longitude; this fills in the
// label afterwards, and can be re-run if the labelling ever changes.
//
// Nominatim allows one request per second and asks that callers identify
// themselves. Both are honoured below. In practice it barely matters: 500
// files in Alessia's archive collapse into 14 distinct places, because a
// gallery of shop windows is a gallery of a handful of neighbourhoods.

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "nexus-studio-gallery/1.0 (+https://nexus-studio.ch)";
const MIN_INTERVAL_MS = 1100;

let lastCall = 0;
const cache = new Map();

// Two shops on the same street are the same place for a filter. Rounding to
// three decimals (~110 m) is what turns hundreds of calls into a dozen.
function cacheKey(latitude, longitude) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export async function reverseGeocode(latitude, longitude) {
  const key = cacheKey(latitude, longitude);
  if (cache.has(key)) return cache.get(key);

  await throttle();

  const url = new URL(ENDPOINT);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  // 10 is city level; finer zooms return a street, which is not a filter.
  url.searchParams.set("zoom", "10");
  url.searchParams.set("accept-language", "fr,en");

  let result = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = await res.json();
      const a = data.address ?? {};
      const city =
        a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
      if (city) result = { city, country: a.country ?? null };
    }
  } catch {
    // Offline or rate-limited: the row keeps its coordinates and a later run
    // fills the label. Never fatal.
  }

  cache.set(key, result);
  return result;
}
