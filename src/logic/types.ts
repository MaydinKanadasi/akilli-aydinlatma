// Yoldaki nesnenin türü
export type ObjectType = "pedestrian" | "car";

// Verinin nereden geldiği: tarayıcıdaki simülatör, Unity ya da gerçek devre
export type DataSourceKind = "mock" | "unity" | "esp32";

export interface TrackedObject {
  type: ObjectType;
  speedKmh: number;
  // Lamba cinsinden konum: 1 = 1. lambanın hizası, 2.3 = 2. ile 3. lamba arası (2.'ye yakın)
  position: number;
}

export interface SystemState {
  source: DataSourceKind;
  isNight: boolean;
  object: TrackedObject | null; // yolda nesne yoksa null
  lamps: number[]; // 5 lambanın parlaklığı, % (0–100)
  powerW: number; // akıllı sistemin anlık gücü
  normalPowerW: number; // aynı anda tüm lambalar %100 yansaydı çekilecek güç
}

// Zaman grafikleri için simülasyonun belli bir andaki durumu
export interface HistorySample {
  t: number; // simülasyon zamanı (sn)
  lamps: number[];
  powerW: number;
  normalPowerW: number;
}
