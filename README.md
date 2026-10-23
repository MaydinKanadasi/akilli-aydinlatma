# Akıllı Sokak Aydınlatması

ESP32 tabanlı akıllı sokak aydınlatma sisteminin web arayüzü ve simülasyonu. Yoldaki yaya ve araçlar algılanır, lambalar PWM ile kısılıp açılır: ışık nesneyle birlikte ilerler, nesnenin olmadığı yerde lambalar kapalı kalır. Böylece gece boyunca tüm lambaları %100 yakan klasik sisteme göre ciddi enerji tasarrufu sağlanır.

**Canlı demo:** https://akilli-aydinlatma.vercel.app

## Ders Bilgisi

| | |
|---|---|
| **Ders** | Karmaşık Mühendislik Tasarımı (MOS2-4701) |
| **Öğretim Üyesi** | Dr. Öğr. Üyesi Arzu Türksoy, Elektrik-Elektronik Mühendisliği |
| **Kurum** | İskenderun Teknik Üniversitesi |

## Kontrol Kuralları

1. Gündüz tüm lambalar kapalıdır (%0).
2. Gece yolda nesne yoksa tüm lambalar kapalıdır (%0).
3. Nesnenin bulunduğu lamba %100 yanar.
4. Önündeki lambalar %40 ve %20 olarak kademeli yanar. Araçlarda, aracın birkaç saniye içinde ulaşacağı lambalar önceden %100 yakılır; bu sayı hıza ve lamba aralığına göre hesaplanır (aralık / hız).
5. Hemen arkadaki lamba %20'ye iner, daha gerideki lambalar kapanır.
6. Yaya/araç ayrımı hız eşiğiyle yapılır (varsayılan: 7 km/s üstü araç).

## Demo Özellikleri

- **Canlı yol sahnesi:** Gece yıldızlı gökyüzü ve ay, gündüz güneş ve bulutlar; kaldırımlar ve şeritler. Lambalarda parlama, ışık konisi ve yolda ışık halkası. Kaldırımda yürüyen yaya, jantları dönen ve gece farları yanan araç.
- **Nesne gönderme:** Hazır butonlar ve 1–120 km/s arası hız kaydırıcısı. Yoldaki nesnenin hızı canlı değiştirilebilir; eşik aşıldığında yaya/araç türü de değişir.
- **Zaman kontrolü:** Duraklat/devam, tek adım ilerletme (çeyrek lamba aralığı), 1x/5x/10x hız.
- **Sürükleme:** Yola tıklayıp sürükleyerek nesne istenen konuma taşınabilir.
- **Gündüz/gece geçişi.**
- **Enerji paneli:** Akıllı ve normal sistemin anlık gücü, biriken tüketimi ve tasarruf yüzdesi.
- **Zaman grafikleri:** Son ~30 saniyede anlık güç (tasarruf alanı boyalı) ve 5 lambanın parlaklığı. Fareyle grafik üzerinde gezinerek o anki değerler okunabilir.
- **PWM paneli:** Osiloskop görünümünde akan kare dalgalar, lamba başına ampul göstergesi, duty çubuğu ve ESP32 LEDC için 8 bitlik duty değeri (0–255).

## Mimari

Arayüz veriyi tek bir ortak formattan okur. Bu sayede veri kaynağı tarayıcıdaki simülasyon, Unity simülasyonu ya da gerçek ESP32 devresi olabilir; arayüzün geri kalanı değişmez.

```json
{
  "source": "mock",
  "isNight": true,
  "object": { "type": "car", "speedKmh": 40, "position": 2.3 },
  "lamps": [20, 100, 40, 20, 0],
  "powerW": 3.6,
  "normalPowerW": 10
}
```

- `source`: `mock` (tarayıcı simülasyonu), `unity` veya `esp32`
- `position`: Lamba cinsinden konum. `1` = 1. lambanın hizası, `2.3` = 2. ile 3. lamba arası.
- `lamps`: 5 lambanın parlaklığı (%)

### Varsayılan Parametreler

| Parametre | Değer |
|---|---|
| Lamba aralığı | 30 m |
| Araç için önden aydınlatma süresi | 3 sn |
| Yaya/araç hız eşiği | 7 km/s |
| Lamba gücü (%100) | 100 W |
| PWM frekansı (ESP32 LEDC) | 5 kHz (periyot 200 µs) |
| PWM çözünürlüğü | 8 bit (0–255) |

### Enerji Hesabı

LED gücünün PWM duty cycle ile doğru orantılı olduğu kabul edilir. Akıllı sistemin anlık gücü, her lambanın `nominal güç × parlaklık` değerlerinin toplamıdır. Karşılaştırma için "normal sistem", gece tüm lambaları %100 yakan klasik aydınlatmadır. Tüketim, simülasyon zamanı boyunca biriktirilir.

## Kurulum

Node.js 20.19 veya üzeri gerekir.

```bash
git clone https://github.com/MaydinKanadasi/akilli-aydinlatma.git
cd akilli-aydinlatma
npm install
npm run dev
```

Ardından tarayıcıda `http://localhost:5173` adresini açın.

## Proje Yapısı

```
src/
├── logic/
│   ├── types.ts              # Ortak veri tipleri
│   └── controller.ts         # Lamba kontrol kuralları, enerji hesabı, PWM ayarları
├── hooks/
│   └── useMockSimulation.ts  # Tarayıcı içi simülasyon (veri kaynağı) ve geçmiş kaydı
├── components/
│   ├── RoadView.tsx          # Yol sahnesi, lambalar, yaya ve araç
│   ├── EnergyPanel.tsx       # Enerji karşılaştırması
│   ├── ChartsPanel.tsx       # Zaman grafikleri
│   ├── LineChart.tsx         # Ortak çizgi grafik bileşeni
│   └── PwmPanel.tsx          # Osiloskop görünümlü PWM sinyalleri
└── App.tsx
```

## Yol Haritası

- [x] Demo web arayüzü (tarayıcı içi simülasyon)
- [x] Görsel revizyon: sahne, zaman grafikleri, PWM paneli
- [ ] Unity simülasyonu
- [ ] Unity ↔ web arayüzü WebSocket bağlantısı
- [ ] ESP32 canlı veri entegrasyonu

## Ekip

| Görev | Üye |
|---|---|
| Web arayüzü ve Unity simülasyonu | Muhammet Aydın Kanadaşı, Bilgisayar Mühendisliği ([@MaydinKanadasi](https://github.com/MaydinKanadasi)) |
