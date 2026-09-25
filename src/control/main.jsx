import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createControllerState, DEFAULT_CONFIG, evaluateController, MODES } from "./engine.js";
import { advanceSimulation, createInitialSensors, SCENARIOS } from "./simulator.js";
import "./control.css";
import "../page-brand.css";

const TICK_SECONDS = 60;
const MAX_HISTORY = 48;

const scenarioLabels = {
  [SCENARIOS.CLEAR]: "Clear day",
  [SCENARIOS.DUST]: "Dust event",
  [SCENARIOS.STORM]: "Storm front",
  [SCENARIOS.OUTAGE]: "Grid outage",
};

const modeLabels = {
  [MODES.STARTUP]: "Startup validation",
  [MODES.NORMAL]: "Automatic optimization",
  [MODES.CONSERVE]: "Reserve protection",
  [MODES.STORM]: "Storm capture",
  [MODES.CLEANING]: "Panel cleaning",
  [MODES.MANUAL]: "Manual supervision",
  [MODES.FAULT]: "Safety isolation",
};

function fmt(value, unit = "", digits = 1) {
  return `${Number(value).toFixed(digits)}${unit}`;
}

function App() {
  const initialSensors = useMemo(() => createInitialSensors(), []);
  const initialState = useMemo(() => ({ ...createControllerState(), uptimeSeconds: 10 }), []);
  const initialResult = useMemo(() => evaluateController({ sensors: initialSensors, previousState: initialState, dtSeconds: TICK_SECONDS }), [initialSensors, initialState]);
  const [sensors, setSensors] = useState(initialSensors);
  const [controller, setController] = useState(initialResult.nextState);
  const [result, setResult] = useState(initialResult);
  const [scenario, setScenario] = useState(SCENARIOS.CLEAR);
  const [manualEnabled, setManualEnabled] = useState(false);
  const [manualMode, setManualMode] = useState(MODES.NORMAL);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState(() => [historyPoint(initialSensors, initialResult)]);
  const [events, setEvents] = useState(() => [{ id: 1, time: initialSensors.timestamp, level: "info", text: "Control engine online; all interlocks validated" }]);
  const [acknowledged, setAcknowledged] = useState([]);
  const controllerRef = useRef(initialResult.nextState);
  const scenarioRef = useRef(scenario);
  const manualRef = useRef({ enabled: manualEnabled, requestedMode: manualMode });
  const elapsedRef = useRef(0);
  const lastModeRef = useRef(initialResult.mode);
  const lastAlarmIdsRef = useRef(new Set(initialResult.alarms.map((item) => item.id)));

  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { manualRef.current = { enabled: manualEnabled, requestedMode: manualMode }; }, [manualEnabled, manualMode]);

  useEffect(() => {
    if (paused) return undefined;
    const interval = window.setInterval(() => {
      setSensors((currentSensors) => {
        const evaluated = evaluateController({
          sensors: currentSensors,
          previousState: controllerRef.current,
          manual: manualRef.current,
          dtSeconds: TICK_SECONDS,
        });
        elapsedRef.current += TICK_SECONDS;
        const nextSensors = advanceSimulation({
          sensors: currentSensors,
          result: evaluated,
          scenario: scenarioRef.current,
          elapsedSeconds: elapsedRef.current,
          dtSeconds: TICK_SECONDS,
        });
        controllerRef.current = evaluated.nextState;
        setController(evaluated.nextState);
        setResult(evaluated);
        setHistory((items) => [...items, historyPoint(nextSensors, evaluated)].slice(-MAX_HISTORY));

        const newEvents = [];
        if (lastModeRef.current !== evaluated.mode) {
          newEvents.push({ id: Date.now(), time: nextSensors.timestamp, level: evaluated.mode === MODES.FAULT ? "critical" : "info", text: `Mode changed: ${modeLabels[lastModeRef.current]} → ${modeLabels[evaluated.mode]}` });
          lastModeRef.current = evaluated.mode;
        }
        const alarmIds = new Set(evaluated.alarms.map((item) => item.id));
        evaluated.alarms.forEach((item) => {
          if (!lastAlarmIdsRef.current.has(item.id)) newEvents.push({ id: `${Date.now()}-${item.id}`, time: nextSensors.timestamp, level: item.severity, text: item.title });
        });
        lastAlarmIdsRef.current = alarmIds;
        if (newEvents.length) setEvents((items) => [...newEvents, ...items].slice(0, 20));
        return nextSensors;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [paused]);

  const activeAlarms = result.alarms.filter((item) => !acknowledged.includes(item.id));
  const connectionHealthy = result.mode !== MODES.FAULT;

  const applyScenario = (nextScenario) => {
    setScenario(nextScenario);
    setAcknowledged([]);
    setEvents((items) => [{ id: Date.now(), time: sensors.timestamp, level: "info", text: `Simulation profile loaded: ${scenarioLabels[nextScenario]}` }, ...items].slice(0, 20));
  };

  return (
    <div className="control-app">
      <header className="topbar">
        <a className="control-brand page-brand" href="/" aria-label="WELOS home"><img src="/welos-brand-transparent.png" alt="" /><span><strong>WELOS</strong><small>URBAN RESOURCE SYSTEM</small></span></a>
        <div className="topbar-site"><span>ROOFTOP NODE</span><b>DXB–WLS–001</b></div>
        <div className="topbar-clock"><span>SIMULATION TIME</span><b>{new Date(sensors.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b></div>
        <div className={`connection ${connectionHealthy ? "online" : "offline"}`}><i />{connectionHealthy ? "LINK HEALTHY" : "SAFETY LOCK"}</div>
      </header>

      <aside className="rail" aria-label="Control sections">
        <span className="rail-label">OPERATIONS</span>
        {["Overview", "Energy", "Water", "Maintenance", "Events"].map((item, index) => <a key={item} href={`#${item.toLowerCase()}`} className={index === 0 ? "active" : ""}><i>{String(index + 1).padStart(2, "0")}</i><span>{item}</span></a>)}
        <div className="rail-version"><span>ENGINE</span><b>v1.0.0</b><small>REFERENCE BUILD</small></div>
      </aside>

      <main className="control-main" id="overview">
        <section className={`mode-banner mode-${result.mode.toLowerCase()}`}>
          <div><span className="overline">CURRENT OPERATING STATE</span><h1>{modeLabels[result.mode]}</h1><p>{controller.lastDecision}</p></div>
          <div className="mode-code"><span>MODE</span><b>{result.mode}</b><small>Transition {new Date(controller.lastTransitionAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
        </section>

        <section className="kpi-strip" aria-label="Key system measurements">
          <Metric label="Renewable input" value={fmt(result.power.renewableKw, " kW", 2)} meta={`${fmt(result.power.pvKw, " PV", 2)} · ${fmt(result.power.windKw, " WIND", 2)}`} tone="amber" />
          <Metric label="Active demand" value={fmt(result.power.demandKw, " kW", 2)} meta={`${fmt(result.power.servedLoadKw, " kW served", 2)}`} tone="neutral" />
          <Metric label="Battery reserve" value={fmt(sensors.batterySoc, "%", 1)} meta={`${fmt(sensors.batteryVoltageV, " V", 1)} · reserve ${result.power.reserveSoc}%`} tone="green" />
          <Metric label="Water storage" value={fmt(sensors.tankLevelPct, "%", 1)} meta={`${fmt(result.water.captureRateLpm, " L/min", 1)} capture`} tone="cyan" />
          <Metric label="Open alarms" value={String(activeAlarms.length).padStart(2, "0")} meta={activeAlarms[0]?.title || "All checks nominal"} tone={activeAlarms.length ? "red" : "green"} />
        </section>

        <section className="dashboard-grid">
          <Panel title="Live resource bus" code="ENERGY / 01" className="power-panel" id="energy">
            <PowerFlow result={result} sensors={sensors} />
          </Panel>
          <Panel title="Battery protection" code="STORAGE / 02" className="battery-panel">
            <BatteryPanel sensors={sensors} result={result} history={history} />
          </Panel>
          <Panel title="Water routing" code="HYDRO / 03" className="water-panel" id="water">
            <WaterPanel sensors={sensors} result={result} />
          </Panel>
          <Panel title="Operating conditions" code="ENV / 04" className="conditions-panel">
            <Conditions sensors={sensors} />
          </Panel>
          <Panel title="Soiling and cleaning" code="MAINT / 05" className="maintenance-panel" id="maintenance">
            <Maintenance sensors={sensors} result={result} controller={controller} />
          </Panel>
          <Panel title="Control authority" code="COMMAND / 06" className="control-panel">
            <ControlAuthority manualEnabled={manualEnabled} setManualEnabled={setManualEnabled} manualMode={manualMode} setManualMode={setManualMode} paused={paused} setPaused={setPaused} result={result} />
          </Panel>
          <Panel title="Scenario injection" code="SIM / 07" className="scenario-panel">
            <div className="scenario-grid">{Object.values(SCENARIOS).map((item) => <button key={item} className={scenario === item ? "active" : ""} onClick={() => applyScenario(item)}><i /><span>{scenarioLabels[item]}</span><small>{scenarioDescription(item)}</small></button>)}</div>
          </Panel>
          <Panel title="Alarms and event journal" code="EVENTS / 08" className="events-panel" id="events">
            <EventJournal alarms={activeAlarms} events={events} onAcknowledge={(id) => setAcknowledged((items) => [...items, id])} />
          </Panel>
          <Panel title="Actuator states" code="I/O / 09" className="actuator-panel">
            <ActuatorTable outputs={result.outputs} />
          </Panel>
        </section>

        <footer className="control-footer"><span>REFERENCE CONTROL SOFTWARE — HARDWARE CALIBRATION REQUIRED BEFORE FIELD ACTUATION</span><span>60× SIMULATION RATE · AUTO-SAVE OFF</span></footer>
      </main>
    </div>
  );
}

function Panel({ title, code, className = "", id, children }) {
  return <section className={`panel ${className}`} id={id}><header><div><span>{code}</span><h2>{title}</h2></div><i className="panel-status" /></header><div className="panel-body">{children}</div></section>;
}

function Metric({ label, value, meta, tone }) {
  return <div className={`metric tone-${tone}`}><span>{label}</span><b>{value}</b><small>{meta}</small></div>;
}

function PowerFlow({ result, sensors }) {
  const charging = result.power.batteryChargeKw > 0;
  const batteryValue = charging ? result.power.batteryChargeKw : result.power.batteryDischargeKw;
  return <div className="power-flow">
    <FlowNode label="PV ARRAY" value={fmt(result.power.pvKw, " kW", 2)} status={result.outputs.pvContactor ? "active" : "off"} />
    <FlowNode label="WIND TURBINE" value={fmt(result.power.windKw, " kW", 2)} status={result.outputs.windBrake ? "off" : "active"} />
    <div className="resource-bus"><span>DC RESOURCE BUS</span><b>{fmt(result.power.renewableKw, " kW", 2)}</b><i /></div>
    <FlowNode label="SITE LOAD" value={fmt(result.power.servedLoadKw, " kW", 2)} status="load" />
    <FlowNode label={`BATTERY ${charging ? "CHARGE" : "DISCHARGE"}`} value={fmt(batteryValue, " kW", 2)} status={batteryValue > 0 ? "battery" : "idle"} />
    <FlowNode label={sensors.gridAvailable ? "GRID EXCHANGE" : "GRID ISOLATED"} value={fmt(result.power.gridImportKw || result.power.gridExportKw, " kW", 2)} status={sensors.gridAvailable ? "grid" : "off"} />
    <div className="flow-note"><span>ROUTING DECISION</span><p>{result.nextState.lastDecision}</p></div>
  </div>;
}

function FlowNode({ label, value, status }) {
  return <div className={`flow-node control-flow-node status-${status}`}><i /><span>{label}</span><b>{value}</b></div>;
}

function BatteryPanel({ sensors, result, history }) {
  const trend = history.map((item) => item.soc);
  return <div className="battery-wrap">
    <div className="battery-main"><div className="battery-shell"><span style={{ height: `${sensors.batterySoc}%` }} /></div><div><strong>{fmt(sensors.batterySoc, "%", 1)}</strong><small>STATE OF CHARGE</small><em>Protected floor {result.power.reserveSoc}%</em></div></div>
    <Sparkline values={trend} color="#F0A50E" />
    <div className="instrument-row"><Instrument label="Voltage" value={fmt(sensors.batteryVoltageV, " V", 1)} /><Instrument label="Current" value={fmt(sensors.batteryCurrentA, " A", 1)} /><Instrument label="Temperature" value={fmt(sensors.batteryTempC, "°C", 1)} /></div>
    <div className="charge-state"><span>{result.power.batteryChargeKw > 0 ? "CHARGING" : result.power.batteryDischargeKw > 0 ? "SUPPLYING" : "RESERVE HOLD"}</span><b>{fmt(result.power.batteryChargeKw || result.power.batteryDischargeKw, " kW", 2)}</b></div>
  </div>;
}

function WaterPanel({ sensors, result }) {
  const route = result.water.firstFlushActive ? "FIRST FLUSH" : result.water.storageActive ? "FILTER TO STORAGE" : result.water.overflowActive ? "BYPASS / OVERFLOW" : "STANDBY";
  return <div className="water-layout"><div className="tank"><div className="tank-fill" style={{ height: `${sensors.tankLevelPct}%` }} /><span>{fmt(sensors.tankLevelPct, "%", 0)}</span></div><div className="water-data"><Instrument label="Rainfall" value={fmt(sensors.rainfallMmHr, " mm/h", 1)} /><Instrument label="Capture" value={fmt(result.water.captureRateLpm, " L/min", 1)} /><Instrument label="Turbidity" value={fmt(sensors.waterTurbidityNtu, " NTU", 1)} /><div className="route-state"><span>ACTIVE ROUTE</span><b>{route}</b></div></div></div>;
}

function Conditions({ sensors }) {
  return <div className="condition-grid"><Instrument label="Irradiance" value={fmt(sensors.solarIrradianceWm2, " W/m²", 0)} /><Instrument label="Wind" value={fmt(sensors.windSpeedMs, " m/s", 1)} /><Instrument label="Ambient" value={fmt(sensors.ambientTempC, "°C", 1)} /><Instrument label="Panel" value={fmt(sensors.panelTempC, "°C", 1)} /><Instrument label="Humidity" value={fmt(sensors.humidityPct, "% RH", 0)} /><Instrument label="Grid" value={sensors.gridAvailable ? "AVAILABLE" : "OFFLINE"} /></div>;
}

function Maintenance({ sensors, result, controller }) {
  return <div className="maintenance-layout"><div className="soiling-index"><span>SOILING INDEX</span><strong>{fmt(sensors.soilingIndex * 100, "%", 1)}</strong><div><i style={{ width: `${Math.min(100, sensors.soilingIndex / 0.25 * 100)}%` }} /></div><small>Automatic trigger {fmt(DEFAULT_CONFIG.cleaningAutoThreshold * 100, "%", 0)}</small></div><div className="eligibility"><span className={result.cleaning.eligible ? "eligible" : "blocked"}>{result.cleaning.eligible ? "CLEANING ELIGIBLE" : "CLEANING DEFERRED"}</span>{result.cleaning.eligible ? <p>Water, wind, irradiance and panel temperature are inside the safe envelope.</p> : <ul>{result.cleaning.blockers.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>}<small>{controller.cleaningCycles} completed cycles</small></div></div>;
}

function ControlAuthority({ manualEnabled, setManualEnabled, manualMode, setManualMode, paused, setPaused, result }) {
  return <div className="authority"><div className="authority-head"><div><span>CONTROL SOURCE</span><b>{manualEnabled ? "SUPERVISOR" : "AUTOMATIC ENGINE"}</b></div><button className={`switch ${manualEnabled ? "on" : ""}`} onClick={() => setManualEnabled(!manualEnabled)} aria-pressed={manualEnabled}><i /></button></div><div className="mode-buttons">{[MODES.NORMAL, MODES.CONSERVE, MODES.STORM, MODES.CLEANING].map((mode) => <button key={mode} disabled={!manualEnabled} onClick={() => setManualMode(mode)} className={manualMode === mode ? "active" : ""}>{mode}</button>)}</div><div className="safety-copy"><span>SAFETY PRECEDENCE</span><p>Emergency, battery, inverter, wind and water interlocks always override supervisor commands.</p></div><button className="pause-button" onClick={() => setPaused(!paused)}><span>{paused ? "RESUME SIMULATION" : "PAUSE SIMULATION"}</span><b>{paused ? "HELD" : result.mode}</b></button></div>;
}

function EventJournal({ alarms, events, onAcknowledge }) {
  const rows = alarms.length ? alarms.map((item) => ({ ...item, alarm: true, time: Date.now(), text: item.title })) : events;
  return <div className="event-list">{rows.slice(0, 6).map((item) => <div key={item.id} className={`event event-${item.severity || item.level}`}><i /><time>{new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><div><b>{item.text}</b>{item.detail && <small>{item.detail}</small>}</div>{item.alarm && <button onClick={() => onAcknowledge(item.id)}>ACK</button>}</div>)}</div>;
}

function ActuatorTable({ outputs }) {
  const labels = { pvContactor: "PV contactor", windContactor: "Wind contactor", windBrake: "Turbine brake", batteryContactor: "Battery contactor", gridContactor: "Grid contactor", firstFlushValve: "First-flush valve", storageValve: "Storage valve", overflowValve: "Overflow valve", cleaningPump: "Cleaning pump", filtrationPump: "Filtration pump", loadShedRelay: "Load-shed relay" };
  return <div className="actuator-grid">{Object.entries(outputs).map(([key, value]) => <div key={key}><span>{labels[key]}</span><b className={value ? "state-on" : "state-off"}>{value ? "ENERGIZED" : "OPEN"}</b></div>)}</div>;
}

function Instrument({ label, value }) {
  return <div className="instrument"><span>{label}</span><b>{value}</b></div>;
}

function Sparkline({ values, color }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${36 - ((value - min) / range) * 30}`).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Battery state-of-charge trend"><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}

function historyPoint(sensors, result) {
  return { time: sensors.timestamp, renewable: result.power.renewableKw, load: result.power.demandKw, soc: sensors.batterySoc, tank: sensors.tankLevelPct };
}

function scenarioDescription(scenario) {
  if (scenario === SCENARIOS.DUST) return "Rising soiling and wind";
  if (scenario === SCENARIOS.STORM) return "High wind and rain capture";
  if (scenario === SCENARIOS.OUTAGE) return "Islanded reserve protection";
  return "Nominal solar production";
}

createRoot(document.getElementById("control-root")).render(<App />);
