export default async function handler(req, res) {
  const query = String(req.query?.q || "").trim();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  if (query.length < 2 || query.length > 80) return res.status(400).json({ error: "Enter a place name (2–80 characters)." });
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WELOSConfigurator/1.0 (https://welos-five.vercel.app/; contact: tejaswi-raghav via GitHub)",
        Referer: "https://welos-five.vercel.app/",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Place search returned ${response.status}`);
    const results = (await response.json()).map((place) => ({
      name: place.display_name,
      lat: Number(place.lat),
      lon: Number(place.lon),
    })).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon));
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ results, attribution: "© OpenStreetMap contributors" });
  } catch (error) {
    return res.status(502).json({ error: "Place search is temporarily unavailable. Try coordinates instead." });
  }
}
