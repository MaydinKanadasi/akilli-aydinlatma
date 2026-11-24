// Kontrol mantığı için test vektörleri üretir.
// Unity'deki C# karşılığı bu dosyanın ürettiği JSON ile birebir karşılaştırılır (EditMode testi).
//
// Çalıştırma (Node 22.18+ TypeScript'i doğrudan çalıştırır):
//   node scripts/test-vektorleri.ts > kontrol-vektorleri.json
//
// Çıktı Unity JsonUtility ile okunabilecek biçimdedir: kök nesne, "null" yerine hasObject alanı.
import {
  DEFAULT_CONFIG,
  classifyBySpeed,
  computeState,
} from "../src/logic/controller.ts";
import type { TrackedObject } from "../src/logic/types.ts";

interface Vector {
  isNight: boolean;
  hasObject: boolean;
  type: string; // "pedestrian" | "car" | "" (nesne yoksa)
  speedKmh: number;
  position: number;
  lamps: number[];
  powerW: number;
  normalPowerW: number;
}

// Konumlar: 0'dan 6'ya 0,05 adımla (i / 20 tam olarak gösterilebilir; 0,5'ler dahil)
const positions = Array.from({ length: 6 * 20 + 1 }, (_, i) => i / 20);

// Hızlar: yaya/araç eşiğinin iki yanı (7 / 7,1) ve önden yakılacak lamba sayısının
// değiştiği sınırlar (36, 72, 108, 144 km/s'de hız × 3 sn / 30 m tam sayı olur)
const speeds = [1, 3, 5, 6.9, 7, 7.1, 8, 10, 20, 35.9, 36, 36.1, 40, 50, 54, 71.9, 72, 72.1, 90, 108, 120, 144, 150];

const vectors: Vector[] = [];

function add(isNight: boolean, object: TrackedObject | null) {
  const s = computeState(isNight, object, "mock", DEFAULT_CONFIG);
  vectors.push({
    isNight,
    hasObject: object !== null,
    type: object?.type ?? "",
    speedKmh: object?.speedKmh ?? 0,
    position: object?.position ?? 0,
    lamps: s.lamps,
    powerW: s.powerW,
    normalPowerW: s.normalPowerW,
  });
}

// Kural 1 ve 2: nesne yokken gece ve gündüz
add(true, null);
add(false, null);

for (const speedKmh of speeds) {
  const type = classifyBySpeed(speedKmh, DEFAULT_CONFIG);
  for (const position of positions) {
    add(true, { type, speedKmh, position });
  }
  // Gündüz (Kural 1) için birkaç örnek yeterli
  for (const position of [0, 1, 2.5, 6]) {
    add(false, { type, speedKmh, position });
  }
}

process.stdout.write(
  JSON.stringify({ config: DEFAULT_CONFIG, vectors }, null, 0) + "\n",
);
