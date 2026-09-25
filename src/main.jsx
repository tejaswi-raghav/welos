import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "./style.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SEQUENCE_FRAMES = 113;

const stats = [
  { value: "2,285", unit: "kWh/m²/yr", label: "Approx. annual GHI used in the project model" },
  { value: "1.1–4.5", unit: "m/s", label: "Typical onshore wind-speed range considered" },
  { value: "94.7–130", unit: "mm/yr", label: "Annual precipitation range used for sizing" },
  { value: "0.29–12.7", unit: "%", label: "Modeled soiling-loss range in the technical study" },
];

const modules = [
  {
    id: "solar",
    number: "01",
    title: "Solar generation",
    kicker: "PRIMARY ENERGY",
    color: "lime",
    text: "The inclined photovoltaic surface provides the system’s dependable daytime generation layer while simultaneously becoming the rain-catching surface.",
    bullets: ["Monocrystalline PV", "MPPT tracking", "Thermal + soiling monitoring"],
  },
  {
    id: "wind",
    number: "02",
    title: "Urban wind",
    kicker: "COMPLEMENTARY ENERGY",
    color: "blue",
    text: "A compact vertical-axis turbine captures low-speed, turbulent rooftop flows without needing a yaw mechanism.",
    bullets: ["Vertical-axis architecture", "Low cut-in target ≈ 1.5 m/s", "PMSG generator"],
  },
  {
    id: "water",
    number: "03",
    title: "Rainwater recovery",
    kicker: "HYDROLOGICAL LAYER",
    color: "cyan",
    text: "Rain runs across the PV apron into an integrated perimeter channel, then passes through first-flush diversion, filtration and storage.",
    bullets: ["1.0–1.5 mm first flush", "50 μm + carbon + sediment", "UV-C disinfection + storage"],
  },
  {
    id: "control",
    number: "04",
    title: "Edge intelligence",
    kicker: "CONTROL LAYER",
    color: "amber",
    text: "The controller continuously compares expected and measured solar performance, routes energy, manages water states and triggers condition-based cleaning.",
    bullets: ["Clear-sky comparison", "Dynamic resource routing", "Condition-based maintenance"],
  },
];

const flow = [
  ["SUN", "PV ARRAY", "MPPT / DC BUS", "HOME LOADS", "BATTERY"],
  ["RAIN", "PV APRON", "FIRST FLUSH", "FILTRATION", "STORAGE"],
  ["WIND", "VAWT", "PMSG", "RECTIFIER", "DC BUS"],
];

function Icon({ type }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
    wind: <><path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></>,
    water: <><path d="M12 2.8S5.5 10.1 5.5 14.2A6.5 6.5 0 0 0 18.5 14.2C18.5 10.1 12 2.8 12 2.8Z"/><path d="M9 15.5c.7.8 1.6 1.2 2.8 1.2"/></>,
    battery: <><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h3v4H8zM15 10h1v4h-1zM20 10h1v4h-1z"/></>,
    cpu: <><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/><path d="M10 10h4v4h-4z"/></>,
    droplet: <path d="M12 2.5S6 9.3 6 14a6 6 0 0 0 12 0c0-4.7-6-11.5-6-11.5Z"/>,
    arrow: <><path d="M4 12h16"/><path d="m14 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg {...common}>{paths[type]}</svg>;
}

function ClimateSequence() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const currentFrameRef = useRef(0);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canvas || !context) return undefined;

    const drawFrame = (index) => {
      const image = imagesRef.current[index];
      if (!image?.complete || !image.naturalWidth) return;

      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const renderWidth = image.naturalWidth * scale;
      const renderHeight = image.naturalHeight * scale;
      context.fillStyle = "#eef2ef";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, (width - renderWidth) / 2, (height - renderHeight) / 2, renderWidth, renderHeight);
    };

    const loadFrame = (index) => {
      if (imagesRef.current[index]) return;
      const image = new Image();
      image.decoding = "async";
      image.src = `/sequence/frame_${String(index + 1).padStart(3, "0")}.jpg`;
      image.onload = () => {
        if (!active) return;
        if (index === 0) {
          if (currentFrameRef.current === 0) drawFrame(0);
          setFirstFrameReady(true);
        } else if (index === currentFrameRef.current) {
          drawFrame(index);
        }
      };
      imagesRef.current[index] = image;
    };

    loadFrame(0);
    if (reduceMotion) {
      currentFrameRef.current = SEQUENCE_FRAMES - 1;
      loadFrame(SEQUENCE_FRAMES - 1);
    }
    for (let index = 1; index < Math.min(SEQUENCE_FRAMES, 18); index += 1) loadFrame(index);

    const warmSequence = () => {
      for (let index = 18; index < SEQUENCE_FRAMES; index += 1) loadFrame(index);
    };
    const idleId = "requestIdleCallback" in window
      ? window.requestIdleCallback(warmSequence, { timeout: 1800 })
      : window.setTimeout(warmSequence, 400);

    const onResize = () => drawFrame(currentFrameRef.current);
    window.addEventListener("resize", onResize, { passive: true });

    canvas.drawSequenceFrame = (index) => {
      currentFrameRef.current = index;
      drawFrame(index);
    };

    return () => {
      active = false;
      window.removeEventListener("resize", onResize);
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      imagesRef.current = [];
      delete canvas.drawSequenceFrame;
    };
  }, []);

  useGSAP(() => {
    const canvas = canvasRef.current;
    const frame = { value: 0 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) return;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.35,
        invalidateOnRefresh: true,
      },
    });

    timeline
      .to(frame, {
        value: SEQUENCE_FRAMES - 1,
        duration: 1,
        ease: "none",
        onUpdate: () => canvas?.drawSequenceFrame?.(Math.round(frame.value)),
      }, 0)
      .to(".sequence-progress-fill", { scaleX: 1, duration: 1, ease: "none" }, 0)
      .to(".sequence-scroll-orbit", { rotation: 270, duration: 1, ease: "none" }, 0)
      .to(".sequence-scroll-meter-fill", { scaleY: 1, duration: 1, ease: "none" }, 0);
  }, { scope: sectionRef });

  return (
    <section className="climate-sequence" ref={sectionRef} aria-label="WELOS system in motion">
      <div className="sequence-sticky">
        <div className="sequence-media">
          <canvas
            ref={canvasRef}
            className={`sequence-canvas ${firstFrameReady ? "is-ready" : ""}`}
            role="img"
            aria-label="A rooftop WELOS device moves from solar generation through wind capture and rainwater recovery"
          />
        </div>
        <div className="sequence-caption">
          <div className="sequence-brand">
            <img src="/welos-brand-transparent.png" alt="WELOS" />
          </div>
          <div className="sequence-scroll-cue" aria-hidden="true">
            <span className="sequence-scroll-orbit">
              <span className="sequence-scroll-core"><i /><i /><i /></span>
            </span>
            <span className="sequence-scroll-copy"><b>Scroll</b><small>to explore</small></span>
            <span className="sequence-scroll-meter"><i className="sequence-scroll-meter-fill" /></span>
          </div>
          <div className="sequence-chrome" aria-hidden="true">
            <span>WELOS / FIELD SEQUENCE</span>
            <span>SCROLL TO ACTIVATE</span>
          </div>
          <div className="sequence-progress" aria-hidden="true"><span className="sequence-progress-fill" /></div>

          <div className="sequence-copy sequence-copy-intro">
            <span className="sequence-index">01 / EXPOSE</span>
            <h2>One footprint.<br/><i>Always working.</i></h2>
            <p>Follow the system as changing rooftop conditions activate each resource layer.</p>
          </div>
          <div className="sequence-copy sequence-copy-energy">
            <span className="sequence-index">02 / GENERATE</span>
            <h2>Sun above.<br/><i>Wind in motion.</i></h2>
            <p>The photovoltaic roof and vertical-axis turbine share a compact urban platform.</p>
          </div>
          <div className="sequence-copy sequence-copy-water">
            <span className="sequence-index">03 / RECOVER</span>
            <h2>Rain becomes<br/><i>a working resource.</i></h2>
            <p>The same surface collects, routes and filters water through the integrated treatment path.</p>
          </div>
          <div className="sequence-copy sequence-copy-final">
            <span className="sequence-index">04 / COORDINATE</span>
            <h2>Three inputs.<br/><i>One resilient loop.</i></h2>
            <p>Energy, water and sensing converge inside one responsive architecture.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [active, setActive] = useState("solar");
  const [scrolled, setScrolled] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const sequence = document.querySelector(".climate-sequence");
      const sequenceEnd = Math.max(0, (sequence?.offsetHeight || 0) - window.innerHeight);
      const hasPassedSequence = window.scrollY >= sequenceEnd - 2;
      setScrolled(hasPassedSequence);
      setShowNav(hasPassedSequence);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const activeModule = modules.find((m) => m.id === active);

  const demoData = useMemo(() => {
    if (!demo) return { solar: 2.4, wind: 0.32, battery: 68, water: 62 };
    return { solar: 3.1, wind: 0.71, battery: 81, water: 74 };
  }, [demo]);

  return (
    <div className="app">
      <div className="grain" />
      <header className={`nav ${scrolled ? "nav-scrolled" : ""} ${showNav ? "nav-visible" : "nav-hidden"}`}>
        <a className="brand" href="#top" aria-label="WELOS home">
          <span className="brand-welos"><b>wel</b><em>os</em></span>
        </a>
        <nav>
          <a href="#system">System</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#prototype">Prototype</a>
          <a href="/model.html">3D model</a>
          <a href="/explore.html">Exploded view</a>
          <a href="/configure.html">Configure</a>
        </nav>
        <a className="nav-cta" href="/configure.html">Configure your WELOS <span>↗</span></a>
      </header>

      <main id="top">
        <ClimateSequence />

        <section className="hero section-pad">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse" /> UAE URBAN RESOURCE SYSTEM / 01</div>
            <h1>One system.<br/><span>Three resources.</span><br/>Smarter resilience.</h1>
            <p className="hero-lede">
              WELOS integrates <b>solar energy, urban wind and rainwater recovery</b>
              into one compact cyber-physical architecture — then uses real-time intelligence
              to decide how every available resource should be used.
            </p>
            <div className="hero-actions">
              <a href="/model.html" className="button button-dark">Explore the 3D product <span>↗</span></a>
              <a href="/configure.html" className="text-link">Configure for your site <span>↗</span></a>
              <a href="#research" className="text-link">Why this matters in the UAE <span>↗</span></a>
            </div>
            <div className="hero-micro">
              <span><i>01</i> GENERATE</span>
              <span><i>02</i> HARVEST</span>
              <span><i>03</i> OPTIMIZE</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-topline"><span>PROTOTYPE / WELOS-01</span><span>LIVE CONCEPT</span></div>
            <div className="image-frame">
              <img src="/sequence/frame_001.jpg" alt="WELOS integrated solar, wind and rainwater harvesting prototype" />
              <div className="scanline" />
              <div className="visual-tag tag-one"><span className="tag-dot" /> ENERGY + WATER</div>
              <div className="visual-tag tag-two">URBAN MICRO-GRID / 001</div>
              <div className="target target-a" />
              <div className="target target-b" />
            </div>
            <div className="visual-caption">
              <span>Integrated physical architecture</span>
              <span>PV surface doubles as rain catchment</span>
            </div>
          </div>
        </section>

        <section className="ticker">
          <div>☀ SOLAR</div><span>+</span><div>◒ WIND</div><span>+</span><div>◌ WATER</div><span>+</span><div>⌁ EDGE INTELLIGENCE</div>
        </section>

        <section id="research" className="problem section-pad">
          <div className="section-kicker">THE CONTEXT / 02</div>
          <div className="problem-grid">
            <div>
              <h2>The UAE has the resources.<br/><i>The challenge is coordinating them.</i></h2>
            </div>
            <div className="problem-copy">
              <p>
                In an arid, sun-dominant urban environment, the resource profile is asymmetric:
                solar is abundant and predictable, wind is localized and intermittent, while rain
                arrives in short, high-intensity events.
              </p>
              <p>
                WELOS is designed around that reality. Instead of installing isolated
                systems, it gives them a shared structure, shared sensing and a shared control layer.
              </p>
              <div className="stat-row">
                {stats.map((s) => (
                  <div className="stat" key={s.value}>
                    <strong>{s.value}<small>{s.unit}</small></strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="system" className="system-section">
          <div className="section-pad">
            <div className="section-kicker">THE ARCHITECTURE / 03</div>
            <div className="section-head">
              <div>
                <h2>One physical footprint.<br/><i>Four coordinated layers.</i></h2>
              </div>
              <p>The product is not a collection of components. The product is the coordination between them.</p>
            </div>

            <div className="module-layout">
              <div className="module-list">
                {modules.map((m) => (
                  <button className={`module ${active === m.id ? "active" : ""}`} onClick={() => setActive(m.id)} key={m.id}>
                    <span className={`module-icon ${m.color}`}><Icon type={m.id === "solar" ? "sun" : m.id === "wind" ? "wind" : m.id === "water" ? "water" : "cpu"} /></span>
                    <span className="module-meta"><small>{m.number} / {m.kicker}</small><b>{m.title}</b></span>
                    <span className="module-arrow">↗</span>
                  </button>
                ))}
              </div>

              <div className={`module-detail ${activeModule.color}`}>
                <div className="detail-number">{activeModule.number}</div>
                <div className="detail-icon"><Icon type={activeModule.id === "solar" ? "sun" : activeModule.id === "wind" ? "wind" : activeModule.id === "water" ? "water" : "cpu"} /></div>
                <div className="detail-kicker">{activeModule.kicker}</div>
                <h3>{activeModule.title}</h3>
                <p>{activeModule.text}</p>
                <div className="detail-bullets">
                  {activeModule.bullets.map((b) => <span key={b}><Icon type="check" /> {b}</span>)}
                </div>
                <div className="detail-line" />
                <span className="detail-note">INTERACTIVE MODULE / SELECT ANOTHER LAYER</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flow-section section-pad">
          <div className="section-kicker">RESOURCE FLOW / 04</div>
          <div className="section-head">
            <h2>Three inputs.<br/><i>One intelligent bus.</i></h2>
            <p>Every resource follows a different path — but the control system makes the final routing decision.</p>
          </div>
          <div className="flows">
            {flow.map((row, ri) => (
              <div className="flow-row" key={ri}>
                <div className={`flow-source source-${ri}`}>
                  <Icon type={ri === 0 ? "sun" : ri === 1 ? "water" : "wind"} />
                  <span>{row[0]}</span>
                </div>
                {row.slice(1).map((item, i) => (
                  <React.Fragment key={item}>
                    <span className="flow-arrow">→</span>
                    <div className={`flow-node ${i === 1 ? "highlight" : ""}`}>{item}</div>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section id="intelligence" className="intelligence">
          <div className="section-pad">
            <div className="section-kicker">THE INTELLIGENCE / 05</div>
            <div className="int-grid">
              <div className="int-copy">
                <h2>It doesn't just<br/><i>generate.</i><br/>It decides.</h2>
                <p>
                  The edge controller turns environmental measurements into actions. It compares
                  expected PV output with measured output, tracks battery state, monitors water,
                  and routes resources according to system priorities.
                </p>
                <div className="logic-list">
                  <div><span>01</span><b>Sense</b><small>GHI · temperature · voltage · current · wind · water</small></div>
                  <div><span>02</span><b>Compare</b><small>Expected clear-sky performance vs measured PV output</small></div>
                  <div><span>03</span><b>Route</b><small>Load → battery → secondary loads → grid bypass</small></div>
                  <div><span>04</span><b>Act</b><small>First-flush diversion, filtration, storage and cleaning</small></div>
                </div>
              </div>

              <div className="control-card">
                <div className="card-header"><span><i className="live-dot"/> EDGE CONTROL</span><span>ESP32-S3 / STM32</span></div>
                <div className="dashboard">
                  <div className="dash-main">
                    <span>RENEWABLE INPUT</span>
                    <strong>{(demoData.solar + demoData.wind).toFixed(2)} <small>kW</small></strong>
                    <div className="spark"><span style={{height:"32%"}}/><span style={{height:"49%"}}/><span style={{height:"44%"}}/><span style={{height:"67%"}}/><span style={{height:"57%"}}/><span style={{height:"82%"}}/><span style={{height:"73%"}}/><span style={{height:"92%"}}/></div>
                  </div>
                  <div className="dash-grid">
                    <div><Icon type="sun"/><span>SOLAR</span><b>{demoData.solar} kW</b></div>
                    <div><Icon type="wind"/><span>WIND</span><b>{demoData.wind} kW</b></div>
                    <div><Icon type="battery"/><span>BATTERY</span><b>{demoData.battery}%</b></div>
                    <div><Icon type="water"/><span>WATER</span><b>{demoData.water}%</b></div>
                  </div>
                  <div className="decision">
                    <span>ACTIVE DECISION</span>
                    <b>{demo ? "SURPLUS → BATTERY / WATER" : "SOLAR → LOADS / BATTERY"}</b>
                    <small>System state updated in real time</small>
                  </div>
                  <button className="simulate" onClick={() => setDemo(!demo)}>
                    {demo ? "Reset simulation" : "Run system simulation"} <span>▶</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="soiling section-pad">
          <div className="soiling-visual">
            <div className="panel">
              <div className="panel-grid" />
              <div className="dust-layer" />
              <div className="spray s1"/><div className="spray s2"/><div className="spray s3"/>
              <div className="panel-readout"><span>SOILING INDEX</span><strong>15.2%</strong><small>THRESHOLD EXCEEDED</small></div>
            </div>
          </div>
          <div className="soiling-copy">
            <div className="section-kicker">CONDITION-BASED MAINTENANCE / 06</div>
            <h2>The panel tells<br/><i>you when it needs help.</i></h2>
            <p>
              Fixed cleaning schedules can clean too early or leave a panel underperforming.
              WELOS estimates the difference between theoretical clear-sky output and actual
              PV power to calculate a dynamic soiling index.
            </p>
            <div className="threshold">
              <div><span>SI</span><strong>&gt; 0.15</strong><small>cleaning trigger</small></div>
              <div><span>WATER</span><strong>&gt; 20%</strong><small>reserve required</small></div>
              <div><span>WIND</span><strong>&lt; 5 m/s</strong><small>safe wash condition</small></div>
            </div>
            <p className="small-note">When conditions are validated, stored rainwater can power a short automated panel wash — closing the loop between harvesting and maintenance.</p>
          </div>
        </section>

        <section id="prototype" className="prototype section-pad">
          <div className="section-kicker">FROM CONCEPT TO PROOF / 07</div>
          <div className="prototype-head">
            <h2>Build small.<br/><i>Prove the intelligence.</i></h2>
            <p>A scaled functional prototype can validate the core research without pretending to power an entire building.</p>
          </div>
          <div className="prototype-grid">
            {[
              ["100–200 W", "SOLAR MODULE", "Real-time conversion + efficiency tracking"],
              ["50–100 W", "HELICAL VAWT", "Low-speed wind harvesting + DC integration"],
              ["12 V / 24 Ah", "LiFePO₄ STORAGE", "Load buffering + state-of-charge tracking"],
              ["50 μm → UV-C", "WATER TREATMENT", "First flush + filtration + disinfection"],
              ["ESP32-S3 / STM32", "CONTROL UNIT", "Optimization + soiling detection + actuation"],
            ].map((x) => (
              <div className="proto-card" key={x[1]}>
                <strong>{x[0]}</strong><span>{x[1]}</span><p>{x[2]}</p><i>↗</i>
              </div>
            ))}
          </div>
        </section>

        <section className="closing">
          <div className="closing-glow" />
          <div className="section-pad closing-inner">
            <div className="section-kicker">THE BIG IDEA / 08</div>
            <h2>Not three systems.<br/><span>One coordinated resource loop.</span></h2>
            <p>
              WELOS turns an underused urban footprint into a responsive infrastructure layer —
              generating energy, recovering water and maintaining its own solar surface through data-driven control.
            </p>
            <a href="#top" className="button button-light">Back to the beginning ↑</a>
          </div>
        </section>
      </main>

      <footer>
        <div className="brand footer-brand"><span className="brand-welos"><b>wel</b><em>os</em></span></div>
        <span>INTELLIGENT URBAN RESOURCE SYSTEM / 2026</span>
        <span>ENERGY + WATER + INTELLIGENCE</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
