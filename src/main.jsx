import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const evidence = [
  { value: "2,285", unit: "kWh/m²/yr", label: "Solar irradiation", detail: "Annual reference used in the WELOS UAE concept study." },
  { value: "1.1–4.5", unit: "m/s", label: "Variable wind", detail: "Onshore wind-speed range considered in the study." },
  { value: "94.7–130", unit: "mm/yr", label: "Limited rainfall", detail: "Annual precipitation range used for concept sizing." },
  { value: "0.29–12.7", unit: "%", label: "Solar soiling loss", detail: "Modeled loss range that motivates condition-based cleaning." },
];

const ideas = [
  { number: "01", title: "Make one surface do more", text: "The solar canopy is designed to produce electricity and act as a rain catchment, sharing the same limited rooftop footprint." },
  { number: "02", title: "Use local resources selectively", text: "Wind and water modules are added only when site conditions support them. A sunny roof should not be forced into the same design as a windy one." },
  { number: "03", title: "Put intelligence between them", text: "The edge controller compares expected and measured performance, protects battery reserves, and coordinates energy, water, and cleaning decisions." },
];

const destinations = [
  { number: "01", name: "3D model", description: "Orbit the assembled machine and inspect its hardware and software layers.", href: "/model.html", action: "Open model" },
  { number: "02", name: "Exploded view", description: "See the machine separate and rebuild in the dedicated engineering exhibit.", href: "/explore.html", action: "Explore components" },
  { number: "03", name: "Configure a site", description: "Enter a location or your own requirements to preview a tailored system.", href: "/configure.html", action: "Start configuring" },
];

function Brand({ label = "WELOS home" }) {
  return <a className="site-brand" href="/" aria-label={label}><img src="/welos-brand-transparent.png" alt="" /><span><strong>WELOS</strong><small>URBAN RESOURCE SYSTEM</small></span></a>;
}

function App() {
  return <div className="site-shell">
    <header className="site-header"><Brand /><nav aria-label="Page sections"><a href="#problem">The problem</a><a href="#innovation">The innovation</a><a href="#explore">Explore</a></nav><a className="header-guide" href="#explore">Explore the work <span>↗</span></a></header>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-inner"><div className="eyebrow"><span /> WELOS / A NEW RESOURCE SYSTEM</div><h1 id="hero-title">Energy and water<br />should work <em>together.</em></h1><p>Urban rooftops face a complicated resource problem: abundant sun, uneven wind, scarce but intense rain, and solar panels that lose output when dust builds up. WELOS is exploring how one coordinated system can respond to all of it.</p><a className="hero-link" href="#problem">Understand the problem <span>↓</span></a></div><div className="hero-index" aria-hidden="true"><span>SUN</span><i /> <span>WIND</span><i /> <span>RAIN</span><i /> <span>INTELLIGENCE</span></div></section>

      <section className="problem section-wrap" id="problem"><div className="section-top"><span className="section-label">01 / THE PROBLEM</span><span className="section-rule" /></div><div className="problem-intro"><h2>Resources exist.<br /><em>Coordination is missing.</em></h2><div><p>Solar energy, wind, and rain do not arrive at the same time or in equal amounts. Standalone systems can miss opportunities, compete for roof space, and require separate monitoring and maintenance.</p><p>In the UAE context studied for WELOS, strong solar potential sits alongside variable wind, low annual rainfall, and dust-related PV losses. The engineering question is not whether to use every resource everywhere; it is how to select and coordinate the right ones for each site.</p></div></div><div className="evidence-grid">{evidence.map((item) => <article className="evidence-card" key={item.label}><span>{item.label}</span><strong>{item.value}<small>{item.unit}</small></strong><p>{item.detail}</p></article>)}</div><p className="evidence-note">These are reference ranges and model inputs from the WELOS concept study, not guaranteed performance at a particular address. Site design requires local measurements.</p></section>

      <section className="innovation" id="innovation"><div className="section-wrap"><div className="section-top"><span className="section-label">02 / THE INNOVATION</span><span className="section-rule" /></div><div className="innovation-head"><h2>One platform.<br /><em>Built around conditions.</em></h2><p>WELOS combines a shared physical footprint with an internal operating layer. Solar is the primary resource in the current concept; wind and water can complement it where local evidence supports them.</p></div><div className="idea-grid">{ideas.map((idea) => <article className="idea-card" key={idea.number}><span>{idea.number} / INNOVATION</span><h3>{idea.title}</h3><p>{idea.text}</p></article>)}</div><div className="logic-band"><span>THE CONTROL LOOP</span><strong>Sense <i>→</i> Compare <i>→</i> Decide <i>→</i> Act</strong><p>From sunlight and wind to battery state, water level, and panel soiling.</p></div></div></section>

      <section className="explore section-wrap" id="explore"><div className="section-top"><span className="section-label">03 / EXPLORE THE WORK</span><span className="section-rule" /></div><div className="explore-head"><h2>Go deeper,<br /><em>in one place.</em></h2><p>Choose the view that answers your question. The model and configurator are interactive concepts; they are not fabrication-ready engineering documents.</p></div><div className="destination-grid">{destinations.map((item) => <a className="destination-card" key={item.name} href={item.href}><span className="destination-number">{item.number} / EXPLORE</span><span className="destination-arrow" aria-hidden="true">↗</span><h3>{item.name}</h3><p>{item.description}</p><span className="destination-action">{item.action} <b>↗</b></span></a>)}</div></section>
    </main>
    <footer className="site-footer"><Brand label="Back to WELOS home" /><span>ENERGY · WATER · INTELLIGENCE</span><span>CONCEPT DEVELOPMENT / 2026</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
