import type {
  DataSourceKind,
  ObjectType,
  SystemState,
  TrackedObject,
} from "./types";

export const LAMP_COUNT = 5;

export interface ControllerConfig {
  lampSpacingM: number; // iki lamba arası mesafe (m)
  lookaheadSec: number; // araç kaç saniye sonra ulaşacağı lambaları tam yaksın
  pedestrianMaxKmh: number; // bu hızın üstü araç sayılır
  lampPowerW: number; // bir lambanın %100'deki gücü (W)
}

export const DEFAULT_CONFIG: ControllerConfig = {
  lampSpacingM: 30,
  lookaheadSec: 3,
  pedestrianMaxKmh: 7,
  lampPowerW: 100,
};

// Kural 6: yaya/araç ayrımı hız eşiğiyle
export function classifyBySpeed(
  speedKmh: number,
  config = DEFAULT_CONFIG,
): ObjectType {
  return speedKmh > config.pedestrianMaxKmh ? "car" : "pedestrian";
}

// Kural 4: araç için önde %100 yanacak lamba sayısı ("Aralık / Hız" mantığı)
function fullLampsAhead(
  object: TrackedObject,
  config: ControllerConfig,
): number {
  if (object.type === "pedestrian") return 0;
  const speedMs = object.speedKmh / 3.6;
  const lamps = Math.ceil(
    (speedMs * config.lookaheadSec) / config.lampSpacingM,
  );
  return Math.min(Math.max(lamps, 0), LAMP_COUNT - 1);
}

export function computeLampLevels(
  isNight: boolean,
  object: TrackedObject | null,
  config = DEFAULT_CONFIG,
): number[] {
  // Kural 1 ve 2: gündüz ya da yolda nesne yoksa tüm lambalar kapalı
  if (!isNight || object === null) return new Array<number>(LAMP_COUNT).fill(0);

  const current = Math.round(object.position); // nesnenin en yakın olduğu lamba
  const fullAhead = fullLampsAhead(object, config);

  return Array.from({ length: LAMP_COUNT }, (_, i) => {
    const d = i + 1 - current; // lambanın nesneye göre yeri: + önde, - arkada
    if (d === 0) return 100; // Kural 3: bulunduğu lamba
    if (d === -1) return 20; // Kural 5: hemen arkadaki
    if (d < -1) return 0; // Kural 5: daha gerisi
    if (d <= fullAhead) return 100; // Kural 4: aracın yakında ulaşacağı lambalar
    if (d === fullAhead + 1) return 40;
    if (d === fullAhead + 2) return 20;
    return 0;
  });
}

export function computeState(
  isNight: boolean,
  object: TrackedObject | null,
  source: DataSourceKind,
  config = DEFAULT_CONFIG,
): SystemState {
  const lamps = computeLampLevels(isNight, object, config);
  // LED gücü PWM yüzdesiyle yaklaşık doğru orantılı kabul ediliyor
  const powerW = lamps.reduce(
    (sum, level) => sum + (level / 100) * config.lampPowerW,
    0,
  );
  const normalPowerW = isNight ? LAMP_COUNT * config.lampPowerW : 0;
  return { source, isNight, object, lamps, powerW, normalPowerW };
}
