import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CLIMATE, DEFAULT_REQUIREMENTS, recommendModules } from "./recommend.js";

test("sunny, calm, dry site recommends solar but not wind, water or hydro", () => {
  const result = recommendModules({ ...DEFAULT_CLIMATE, solarDailyKwhM2: 5.7, windMs: 3.7, rainMmYear: 84 }, DEFAULT_REQUIREMENTS);
  assert.deepEqual(result.modules, { solar: true, wind: false, water: false, hydro: false });
  assert.ok(result.metrics.solarKwhDay > 0);
});
test("wind and rain trigger their add-ons when site requirements support them", () => {
  const result = recommendModules({ ...DEFAULT_CLIMATE, windMs: 5.5, rainMmYear: 800 }, DEFAULT_REQUIREMENTS);
  assert.equal(result.modules.wind, true);
  assert.equal(result.modules.water, true);
  assert.equal(result.metrics.rainLitresYear, 17920);
});
test("hydro only follows supplied flow and head, never rainfall alone", () => {
  const wet = { ...DEFAULT_CLIMATE, rainMmYear: 3000 };
  assert.equal(recommendModules(wet, DEFAULT_REQUIREMENTS).modules.hydro, false);
  const measured = recommendModules(wet, { ...DEFAULT_REQUIREMENTS, hydroFlowLps: 25, hydroHeadM: 2 });
  assert.equal(measured.modules.hydro, true);
  assert.ok(measured.metrics.hydroKw > 0.2);
});
test("small roof cannot support solar or catchment recommendation", () => {
  const result = recommendModules(DEFAULT_CLIMATE, { ...DEFAULT_REQUIREMENTS, roofAreaM2: 4 });
  assert.equal(result.modules.solar, false);
  assert.equal(result.modules.water, false);
});
