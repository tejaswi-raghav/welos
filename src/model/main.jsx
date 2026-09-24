import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Box, ChevronRight, Crosshair, Layers3, RotateCcw } from "lucide-react";
import { partById, parts, systems } from "./parts.js";
import { createWelosScene } from "./scene.js";
import "./model.css";

const DEFAULT_PART = "controller-pcb";

function ModelApp() {
  const viewportRef = useRef(null);
  const sceneRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [selectedId, setSelectedId] = useState(DEFAULT_PART);
  const [separation, setSeparation] = useState(0);

  const selected = partById[selectedId] || partById[DEFAULT_PART];
  const visibleParts = useMemo(() => {
    if (view === "overview" || view === "controller") return parts.filter((part) => part.system === "controller");
    return parts.filter((part) => part.system === view);
  }, [view]);

  useEffect(() => {
    if (!viewportRef.current) return undefined;
    sceneRef.current = createWelosScene(viewportRef.current, {
      onReady: () => setReady(true),
      onSelect: (id) => {
        setSelectedId(id);
        const system = partById[id]?.system;
        if (system) {
          setView(system);
          sceneRef.current?.setView(system);
        }
      },
      onError: () => setError("This browser could not start the 3D renderer."),
    });
    sceneRef.current?.selectPart(DEFAULT_PART);
    return () => sceneRef.current?.dispose();
  }, []);

  function choosePart(id) {
    setSelectedId(id);
    sceneRef.current?.selectPart(id);
  }

  function chooseSystem(id) {
    setView(id);
    sceneRef.current?.setView(id);
    const first = parts.find((part) => part.system === id);
    choosePart(first?.id || DEFAULT_PART);
  }

  function updateSeparation(value) {
    const next = Number(value);
    setSeparation(next);
    sceneRef.current?.setExploded(next / 100);
  }

  function resetScene() {
    setView("overview");
    setSeparation(0);
    setSelectedId(DEFAULT_PART);
    sceneRef.current?.reset();
    sceneRef.current?.selectPart(DEFAULT_PART);
  }

  return (
    <div className="model-app">
      <header className="model-header">
        <a className="back-link" href="/"><ArrowLeft size={15} aria-hidden="true" />Back to WELOS</a>
        <div className="wordmark" aria-label="WELOS">wel<span>o</span>s</div>
        <div className="prototype-label"><i /> Interactive concept / 01</div>
      </header>

      <main className="model-shell">
        <aside className="system-rail" aria-label="Model systems">
          <div className="rail-intro">
            <span className="eyebrow">Inside the machine</span>
            <h1>One machine.<br />Five systems.</h1>
            <p>A compact rooftop appliance: one canopy, one chassis and connected energy and water systems.</p>
          </div>
          <nav className="system-list">
            {systems.map((system, index) => (
              <button className={view === system.id ? "system-button active" : "system-button"} key={system.id} onClick={() => chooseSystem(system.id)} aria-pressed={view === system.id}>
                <span className="system-index">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{system.name}</strong><small>{system.short}</small></span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <div className="concept-note">
            <span>Model status</span>
            <p>Concept architecture for demonstration. Final electrical, structural and safety design requires licensed engineering validation.</p>
          </div>
        </aside>

        <section className="viewport-panel" aria-label="Interactive WELOS 3D model">
          <div className="viewport-meta"><span><Crosshair size={14} /> Drag to orbit</span><span>Scroll to zoom · click a part</span></div>
          <div className="view-caption"><span>{systems.find((system) => system.id === view)?.code} / {systems.find((system) => system.id === view)?.name}</span><p>{systems.find((system) => system.id === view)?.summary}</p></div>
          <div ref={viewportRef} className="model-viewport" />
          {!ready && !error && <div className="model-loading" role="status"><div className="loading-mark"><span /><span /><span /></div><p>Assembling system model</p></div>}
          {error && <div className="model-error" role="alert"><Box size={30} /><strong>3D view unavailable</strong><p>{error} The component index remains available for inspection.</p></div>}
          <div className="view-controls">
            <label htmlFor="separation"><Layers3 size={15} aria-hidden="true" />System separation</label>
            <input id="separation" type="range" min="0" max="100" step="1" value={separation} onChange={(event) => updateSeparation(event.target.value)} />
            <output htmlFor="separation">{separation === 0 ? "Assembled" : `${separation}%`}</output>
            <button onClick={resetScene} aria-label="Reset model view"><RotateCcw size={15} /></button>
          </div>
        </section>

        <aside className="inspector" aria-live="polite">
          <div className="inspector-head"><span>Component index</span><span>{String(visibleParts.length).padStart(2, "0")}</span></div>
          <div className="part-tabs" role="list" aria-label="Visible components">
            {visibleParts.map((part) => (
              <button key={part.id} className={part.id === selectedId ? "part-tab active" : "part-tab"} onClick={() => choosePart(part.id)} role="listitem"><span>{part.code}</span>{part.name}</button>
            ))}
          </div>
          <article className="part-detail">
            <div className="detail-code">{selected.code} / {selected.category}</div>
            <h2>{selected.name}</h2>
            <p className="detail-role">{selected.role}</p>
            <dl>
              <div><dt>What the model shows</dt><dd>{selected.evidence}</dd></div>
              <div><dt>Validation</dt><dd>{selected.status}</dd></div>
            </dl>
          </article>
          <div className="signal-legend" aria-label="System signal legend">
            <span><i className="sun" /> Solar</span><span><i className="wind" /> Wind</span><span><i className="water" /> Water</span><span><i className="storage" /> Storage</span>
          </div>
        </aside>
      </main>
    </div>
  );
}

const appRoot = createRoot(document.getElementById("model-root"));
appRoot.render(<ModelApp />);
if (import.meta.hot) import.meta.hot.dispose(() => appRoot.unmount());
