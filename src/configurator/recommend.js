export const DEFAULT_CLIMATE = { solarDailyKwhM2: 4.5, windMs: 4, rainMmYear: 250, humidityPct: 50, tempC: 25 };
export const DEFAULT_REQUIREMENTS = { roofAreaM2: 28, dailyLoadKwh: 12, dailyWaterLitres: 80, hydroFlowLps: 0, hydroHeadM: 0 };

const positive = (value) => Math.max(0, Number(value) || 0);

export function recommendModules(climate, requirements) {
  const roof = positive(requirements.roofAreaM2);
  const load = positive(requirements.dailyLoadKwh);
  const water = positive(requirements.dailyWaterLitres);
  const solar = positive(climate.solarDailyKwhM2);
  const wind = positive(climate.windMs);
  const rain = positive(climate.rainMmYear);
  const flow = positive(requirements.hydroFlowLps);
  const head = positive(requirements.hydroHeadM);
  const hydroKw = 0.00981 * flow * head * 0.55;
  const panelCount = Math.min(Math.floor(roof / 2.2), Math.ceil(load / Math.max(0.1, solar * 0.45 * 0.78)));
  const modules = {
    solar: roof >= 8 && solar >= 3,
    wind: wind >= 5,
    water: rain >= 120 && roof >= 8 && water > 0,
    hydro: flow > 0 && head > 0 && hydroKw >= 0.2,
  };
  const metrics = {
    panelCount: modules.solar ? Math.max(1, panelCount) : 0,
    solarKw: modules.solar ? Math.max(1, panelCount) * 0.45 : 0,
    solarKwhDay: modules.solar ? Math.max(1, panelCount) * 0.45 * solar * 0.78 : 0,
    batteryKwh: Math.max(2, Math.ceil(load * 0.5 / 2) * 2),
    rainLitresYear: Math.round(rain * roof * 0.8),
    hydroKw,
  };
  return { modules, metrics };
}
