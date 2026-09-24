# WELOS base product architecture

WELOS is a modular appliance that combines a photovoltaic rain-catching canopy, measured-site urban wind, protected battery storage and monitored rainwater treatment. A local edge controller runs the WELOS OS and continues safe operation without the cloud.

The browser model at `/model.html` depicts a single rooftop unit: a shared panel and rain-catching canopy above the water, power and control bays, with a VAWT on the same platform. A soiling reference cell and valved cleaning rail show how maintenance is triggered and carried out. Its interactive separation view reveals 27 major components. It is a proportioned engineering concept, not fabrication CAD, and does not establish structural, electrical, drinking-water or grid compliance.

## Product boundary

```text
PV canopy ── DC isolator/SPD ── MPPT ───────┐
                                             ├── protected 48 V bus ── battery/BMS
VAWT ── brake ── rectifier/dump load ───────┘             │
                                                           └── hybrid inverter ── critical loads/grid

rain gutter ── first flush ── filters ── UV ── tank ── pump ── approved non-potable loads
                       sensors/actuators ── isolated field I/O ── WELOS OS
```

## Internal OS responsibility

The edge controller samples isolated sensors, applies the deterministic modes in `docs/WELOS_CONTROL_SYSTEM.md`, commands contactors/valves/pumps within hardware limits, records events and exposes the authenticated local API described in `docs/DEVICE_API.md`.

The OS may optimize battery dispatch, cleaning, pump schedules and water routing. It must never replace inverter anti-islanding, branch protection, battery BMS limits, mechanical wind braking, emergency stop, RCD/RCBO protection, tank overflow, backflow prevention or any other required hardwired protection.

## Prototype interfaces

| Interface | Purpose | Design boundary |
| --- | --- | --- |
| CAN | Battery BMS and inverter status | Isolated transceiver; controller cannot override BMS limits |
| RS-485 / Modbus | Meter, inverter, MPPT and water instruments | Galvanically isolated, surge protected |
| 24 V digital I/O | Contactors, pumps, valves, alarms | Interposing relays/drivers with safe default states |
| 0–10 V / 4–20 mA | Pressure, tank level and water-quality sensors | Isolated inputs with open-wire diagnostics |
| Pulse inputs | Water and energy flow metering | Debounced and protected |
| Ethernet / Wi-Fi / LTE | Local dashboard, commissioning and optional cloud | TLS, unique device identity, signed updates |

## Build gates

1. Freeze target power, water duty, climate, site wind resource and jurisdiction.
2. Produce load cases, single-line diagrams, hydraulic P&ID and formal hazard analysis.
3. Select certified modules and update `hardware/bom.json` with manufacturer part numbers and ratings.
4. Bench-test every sensor fault and hardwired trip before energizing sources.
5. Validate thermal, ingress, EMC, vibration, acoustic, water-quality and fail-safe behavior.
6. Complete licensed structural/electrical review and all local approvals before field deployment.

The structured concept BOM is in `hardware/bom.json`. It intentionally records selection criteria rather than inventing part numbers before requirements are known.
