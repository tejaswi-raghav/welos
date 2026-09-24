const PARAMETERS = ["ALLSKY_SFC_SW_DWN", "WS10M", "RH2M", "PRECTOTCORR", "T2M"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  const lat = Number(req.query?.lat);
  const lon = Number(req.query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || req.query?.lat == null || req.query?.lon == null) {
    return res.status(400).json({ error: "Valid latitude and longitude are required." });
  }
  try {
    const url = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
    url.searchParams.set("parameters", PARAMETERS.join(","));
    url.searchParams.set("community", "RE");
    url.searchParams.set("longitude", lon.toFixed(3));
    url.searchParams.set("latitude", lat.toFixed(3));
    url.searchParams.set("format", "JSON");
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`Climate service returned ${response.status}`);
    const data = await response.json();
    const parameters = data.properties?.parameter;
    const metric = (key) => {
      const value = Number(parameters?.[key]?.ANN);
      if (!Number.isFinite(value) || value <= -900) throw new Error(`Missing ${key}`);
      return value;
    };
    const rainDailyMm = metric("PRECTOTCORR");
    const climate = {
      solarDailyKwhM2: metric("ALLSKY_SFC_SW_DWN"),
      windMs: metric("WS10M"),
      humidityPct: metric("RH2M"),
      rainMmYear: Math.round(rainDailyMm * 365.25),
      tempC: metric("T2M"),
    };
    const monthly = MONTHS.map((month) => ({
      month,
      solarDailyKwhM2: Number(parameters.ALLSKY_SFC_SW_DWN[month]),
      windMs: Number(parameters.WS10M[month]),
      rainDailyMm: Number(parameters.PRECTOTCORR[month]),
    }));
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ climate, monthly, source: "NASA POWER", period: data.header?.range || "2001–2020 climatology", latitude: lat, longitude: lon });
  } catch (error) {
    return res.status(502).json({ error: "Climate data is temporarily unavailable. You can still configure manually." });
  }
}
