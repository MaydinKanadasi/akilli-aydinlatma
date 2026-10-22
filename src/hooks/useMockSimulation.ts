import { useEffect, useState } from "react";
import type { TrackedObject } from "../logic/types";
import {
  DEFAULT_CONFIG,
  LAMP_COUNT,
  classifyBySpeed,
  computeState,
  type ControllerConfig,
} from "../logic/controller";

interface SimState {
  isNight: boolean;
  object: TrackedObject | null;
  smartWh: number; // akıllı sistemin biriken tüketimi
  normalWh: number; // aynı sürede normal sistemin tüketimi
}

const TICK_MS = 50; // simülasyon saniyede 20 kez güncellenir
const STEP_LAMPS = 0.25; // "Bir adım" ile nesne çeyrek lamba aralığı ilerler

// Simülasyonu dt saniye ilerletir: nesneyi hareket ettirir, enerjiyi biriktirir
function advance(prev: SimState, dt: number, config: ControllerConfig): SimState {
  const now = computeState(prev.isNight, prev.object, "mock", config);

  let object = prev.object;
  if (object) {
    const position =
      object.position + ((object.speedKmh / 3.6) * dt) / config.lampSpacingM;
    // Son lambayı geçip uzaklaşınca nesne yoldan çıkar
    object = position > LAMP_COUNT + 1 ? null : { ...object, position };
  }

  return {
    ...prev,
    object,
    smartWh: prev.smartWh + (now.powerW * dt) / 3600,
    normalWh: prev.normalWh + (now.normalPowerW * dt) / 3600,
  };
}

export function useMockSimulation(config: ControllerConfig = DEFAULT_CONFIG) {
  const [sim, setSim] = useState<SimState>({
    isNight: true,
    object: null,
    smartWh: 0,
    normalWh: 0,
  });
  // Yaya 150 m'lik yolu gerçek zamanda ~2 dakikada geçer; demo için hızlandırıyoruz
  const [timeScale, setTimeScale] = useState(5);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false); // nesne fareyle tutuluyorsa simülasyon onu hareket ettirmez

  useEffect(() => {
    if (paused || dragging) return; // duraklatıldıysa ya da sürükleniyorsa zamanlayıcı kurulmaz
    const id = setInterval(() => {
      const dt = (TICK_MS / 1000) * timeScale; // simülasyonda geçen süre (sn)
      setSim((prev) => advance(prev, dt, config));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [timeScale, config, paused, dragging]);

  const state = computeState(sim.isNight, sim.object, "mock", config);

  // Nesne varsa çeyrek lamba ilerleyeceği kadar, yoksa 1 saniye ilerletir
  const stepForward = () =>
    setSim((prev) => {
      const dt = prev.object
        ? (STEP_LAMPS * config.lampSpacingM) /
          Math.max(prev.object.speedKmh / 3.6, 0.1)
        : 1;
      return advance(prev, dt, config);
    });

  // Sürükleme sırasında nesneyi verilen konuma taşır (yolun dışına çıkamaz)
  const moveObjectTo = (position: number) =>
    setSim((prev) =>
      prev.object
        ? {
            ...prev,
            object: {
              ...prev.object,
              position: Math.min(Math.max(position, 0), LAMP_COUNT + 1),
            },
          }
        : prev,
    );

  // Yoldaki nesnenin hızını değiştirir; Kural 6 gereği tür de hıza göre yeniden belirlenir
  const setObjectSpeed = (speedKmh: number) =>
    setSim((prev) =>
      prev.object
        ? {
            ...prev,
            object: {
              ...prev.object,
              speedKmh,
              type: classifyBySpeed(speedKmh, config),
            },
          }
        : prev,
    );

  // Nesne 1. lambanın biraz gerisinden (konum 0) yola girer
  const spawn = (speedKmh: number) =>
    setSim((prev) => ({
      ...prev,
      object: {
        type: classifyBySpeed(speedKmh, config),
        speedKmh,
        position: 0,
      },
    }));

  const setNight = (isNight: boolean) =>
    setSim((prev) => ({ ...prev, isNight }));

  const resetEnergy = () =>
    setSim((prev) => ({ ...prev, smartWh: 0, normalWh: 0 }));

  return {
    state,
    energy: { smartWh: sim.smartWh, normalWh: sim.normalWh },
    timeScale,
    setTimeScale,
    paused,
    setPaused,
    stepForward,
    setDragging,
    moveObjectTo,
    setObjectSpeed,
    spawn,
    setNight,
    resetEnergy,
  };
}
