import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createWelosScene } from "../model/scene.js";
import { DEFAULT_CLIMATE, DEFAULT_REQUIREMENTS, recommendModules } from "./recommend.js";
import "./style.css";
import "../page-brand.css";

const ADDONS = [
  { id: "solar", name: "Solar canopy", description: "PV array, MPPT and performance sensing", symbol: "☀", color: "#F0A50E" },
  { id: "wind", name: "Wind turbine", description: "Vertical-axis rotor and rectifier", symbol: "↝", color: "#F0A50E" },
  { id: "water", name: "Rain recovery", description: "Gutter, filtration and storage", symbol: "◈", color: "#F0A50E" },
  { id: "hydro", name: "Micro-hydro", description: "Flow-powered generation module", symbol: "≈", color: "#F0A50E" },
];
const CLIMATE_FIELDS = [
  ["solarDailyKwhM2", "Solar irradiation", "kWh/m²/day", 0, 10, 0.1],
  ["windMs", "Average 10 m wind", "m/s", 0, 30, 0.1],
  ["rainMmYear", "Annual rain", "mm/yr", 0, 5000, 1],
  ["humidityPct", "Humidity", "%", 0, 100, 1],
  ["tempC", "Temperature", "°C", -30, 60, 0.1],
];
const REQUIREMENT_FIELDS = [
  ["roofAreaM2", "Usable area", "m²", 0, 10000, 1],
  ["dailyLoadKwh", "Daily electricity", "kWh/day", 0, 10000, 0.5],
  ["dailyWaterLitres", "Daily non-potable water", "L/day", 0, 100000, 1],
  ["hydroFlowLps", "Measured stream flow", "L/s", 0, 100000, 0.1],
  ["hydroHeadM", "Measured head", "m", 0, 10000, 0.1],
];
const fmt = (value, digits = 1) => Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });

function NumberField({ item, value, onChange }) {
  const [id, label, unit, min, max, step] = item;
  return <label className="number-field"><span>{label}</span><span className="number-input"><input aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(id, event.target.value)} /><em>{unit}</em></span></label>;
}

function App() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [sceneError, setSceneError] = useState(false);
  const [mode, setMode] = useState("location");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState([]);
  const [place, setPlace] = useState(null);
  const [climate, setClimate] = useState(DEFAULT_CLIMATE);
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [overrides, setOverrides] = useState({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasClimate, setHasClimate] = useState(false);
  const [monthly, setMonthly] = useState([]);
  const [period, setPeriod] = useState("");
  const generation = useRef(0);
  const recommendation = useMemo(() => recommendModules(climate, requirements), [climate, requirements]);
  const modules = { ...recommendation.modules, ...overrides };
  const enabledCount = Object.values(modules).filter(Boolean).length;

  useEffect(() => {
    const scene = createWelosScene(mountRef.current, { modules, onError: () => setSceneError(true) });
    sceneRef.current = scene;
    return () => { scene?.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setModules(modules); }, [modules.solar, modules.wind, modules.water, modules.hydro]);

  const setRequirement = (id, value) => setRequirements((current) => ({ ...current, [id]: value === "" ? "" : Number(value) }));
  const setClimateValue = (id, value) => setClimate((current) => ({ ...current, [id]: value === "" ? "" : Number(value) }));

  async function loadClimate(selected) {
    const requestId = ++generation.current;
    setBusy(true); setStatus("Reading 20-year climate averages…"); setPlaces([]);
    try {
      const response = await fetch(`/api/climate?lat=${encodeURIComponent(selected.lat)}&lon=${encodeURIComponent(selected.lon)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Climate lookup failed.");
      if (requestId !== generation.current) return;
      setPlace(selected); setClimate(data.climate); setMonthly(data.monthly); setPeriod(data.period);
      setOverrides({}); setHasClimate(true); setStatus("");
    } catch (error) { if (requestId === generation.current) setStatus(error.message); }
    finally { if (requestId === generation.current) setBusy(false); }
  }

  async function findPlace(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const coords = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coords) {
      const lat = Number(coords[1]), lon = Number(coords[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) { setStatus("Coordinates are outside the valid range."); return; }
      await loadClimate({ name: `${fmt(lat, 4)}°, ${fmt(lon, 4)}°`, lat, lon });
      return;
    }
    const requestId = ++generation.current;
    setBusy(true); setStatus("Finding your location…"); setPlaces([]);
    try {
      const response = await fetch(`/api/location?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Place search failed.");
      if (requestId !== generation.current) return;
      if (!data.results.length) throw new Error("No matching place found. Try a city and country, or coordinates.");
      if (data.results.length === 1) await loadClimate(data.results[0]);
      else { setPlaces(data.results); setStatus("Choose the matching place below."); }
    } catch (error) { if (requestId === generation.current) setStatus(error.message); }
    finally { if (requestId === generation.current) setBusy(false); }
  }

  function switchMode(next) {
    generation.current += 1;
    setMode(next); setBusy(false); setStatus(""); setPlaces([]);
    if (next === "manual") { setHasClimate(false); setClimate(DEFAULT_CLIMATE); setOverrides({}); setPlace(null); setMonthly([]); }
  }

  return <div className="configure-app">
    <header className="configure-header"><a className="page-brand" href="/" aria-label="WELOS home"><img src="/welos-brand-transparent.png" alt="" /><span><strong>WELOS</strong><small>URBAN RESOURCE SYSTEM</small></span></a><div className="page-header-title">SITE CONFIGURATOR</div><a className="page-back" href="/">← &nbsp; OVERVIEW</a></header>
    <main className="configure-main">
      <section className="intro"><div className="eyebrow"><i /> CONFIGURATION STUDIO / 01</div><h1>Built for <em>your</em> site.</h1><p>Start with your location for a climate-informed concept, or shape the machine yourself. Every add-on you select appears on the 3D preview.</p></section>
      <div className="workspace">
        <section className="input-panel" aria-label="Site inputs">
          <div className="panel-heading"><span>01 / INPUTS</span><strong>Tell us about your site</strong></div>
          <div className="mode-tabs" role="tablist" aria-label="Configuration method"><button type="button" role="tab" aria-selected={mode === "location"} className={mode === "location" ? "active" : ""} onClick={() => switchMode("location")}>Use location</button><button type="button" role="tab" aria-selected={mode === "manual"} className={mode === "manual" ? "active" : ""} onClick={() => switchMode("manual")}>Enter manually</button></div>
          {mode === "location" ? <div className="location-area"><label htmlFor="place-search" className="field-title">CITY, ADDRESS OR COORDINATES</label><form onSubmit={findPlace} className="search"><input id="place-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dubai, UAE or 25.20, 55.27" autoComplete="off" /><button disabled={busy || !query.trim()} type="submit">{busy ? "Loading…" : "Analyze ↗"}</button></form><p className="hint">Search on submit only. Coordinates work without place search.</p>{status && <p className="status" role="status">{status}</p>}{places.length > 0 && <div className="place-results" aria-label="Matching places">{places.map((result, i) => <button key={`${result.lat}-${result.lon}-${i}`} onClick={() => loadClimate(result)}>{result.name}<span>↗</span></button>)}</div>}{place && hasClimate && <div className="site-found"><span>CLIMATE PROFILE LOADED</span><strong>{place.name}</strong><small>{period}</small></div>}</div> : <div className="manual-area"><p className="hint">Use your own measured or assumed climate values. The preview recalculates instantly.</p><div className="fields">{CLIMATE_FIELDS.map((item) => <NumberField key={item[0]} item={item} value={climate[item[0]]} onChange={setClimateValue} />)}</div></div>}
          <div className="section-label">YOUR REQUIREMENTS <span>EDIT ANY TIME</span></div><div className="fields">{REQUIREMENT_FIELDS.map((item) => <NumberField key={item[0]} item={item} value={requirements[item[0]]} onChange={setRequirement} />)}</div>
          <p className="footnote">Hydro needs a real stream or pipe with measured flow and head. Rainfall is not a hydro resource estimate.</p>
        </section>
        <section className="preview-panel" aria-label="Customized product preview"><div className="preview-top"><span>02 / LIVE PRODUCT PREVIEW</span><span className="live-pill"><i /> INTERACTIVE 3D</span></div><div ref={mountRef} className="preview-canvas" />{sceneError && <div className="fallback-preview">3D is unavailable on this device. Your selected hardware is listed below.</div>}<div className="preview-bottom"><strong>WELOS / BASE + {enabledCount} ADD-ON{enabledCount === 1 ? "" : "S"}</strong><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div></section>
        <section className="output-panel" aria-label="Recommended add-ons"><div className="panel-heading"><span>03 / OUTPUT</span><strong>Your system</strong></div><div className="base-module"><span>ALWAYS INCLUDED</span><strong>Core intelligence + storage</strong><small>Edge OS, sensors, DC bus and battery cabinet</small></div><div className="addon-list">{ADDONS.map((addon) => <label key={addon.id} className={`addon ${modules[addon.id] ? "on" : ""}`} style={{ "--addon-color": addon.color }}><span className="addon-symbol">{addon.symbol}</span><span className="addon-copy"><strong>{addon.name}</strong><small>{addon.description}</small><em>{overrides[addon.id] === undefined ? "AUTO SUGGESTION" : "MANUAL CHOICE"}</em></span><input type="checkbox" checked={modules[addon.id]} onChange={(event) => setOverrides((current) => ({ ...current, [addon.id]: event.target.checked }))} aria-label={`${addon.name} add-on`} /><span className="switch" /></label>)}</div><button className="reset" onClick={() => setOverrides({})}>Reset to climate recommendations ↺</button><div className="metrics"><div><span>SOLAR ARRAY</span><strong>{modules.solar ? `${recommendation.metrics.panelCount} × 450 W` : "—"}</strong></div><div><span>BATTERY CONCEPT</span><strong>{fmt(recommendation.metrics.batteryKwh, 0)} kWh</strong></div><div><span>RAIN CAPTURE POTENTIAL</span><strong>{modules.water ? `${fmt(recommendation.metrics.rainLitresYear, 0)} L/yr` : "—"}</strong></div><div><span>HYDRO CONCEPT</span><strong>{modules.hydro ? `${fmt(recommendation.metrics.hydroKw, 2)} kW` : "—"}</strong></div></div></section>
      </div>
      <section className="climate-strip" aria-label="Climate basis"><div><span>THE CLIMATE BASIS</span><h2>{hasClimate ? "Measured from the wider world." : mode === "manual" ? "Your numbers. Your design." : "A starting point, wherever you are."}</h2></div><div className="climate-stats"><div><span>SOLAR</span><strong>{fmt(climate.solarDailyKwhM2, 2)}</strong><small>kWh/m²/day</small></div><div><span>WIND AT 10 M</span><strong>{fmt(climate.windMs, 2)}</strong><small>m/s</small></div><div><span>RAIN</span><strong>{fmt(climate.rainMmYear, 0)}</strong><small>mm/year</small></div><div><span>HUMIDITY</span><strong>{fmt(climate.humidityPct, 0)}</strong><small>% average</small></div></div></section>
      <p className="method-note">{hasClimate ? "Climate data: NASA POWER 2001–2020 climatology (satellite/model-derived). Place lookup: © OpenStreetMap contributors. " : ""}This is a screening concept, not an engineering specification. Solar output and rain capture are rough estimates; wind needs a site/hub-height survey, hydro needs verified flow and head, and all components need structural, electrical and regulatory review. {monthly.length > 0 && "Annual recommendations use climate averages; seasonal output can vary substantially."} <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER ↗</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap ↗</a></p>
    </main>
  </div>;
}

createRoot(document.getElementById("configure-root")).render(<App />);
