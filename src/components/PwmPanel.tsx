import { PWM_BITS, PWM_FREQ_HZ } from "../logic/controller";
import "./PwmPanel.css";

const W = 400;
const H = 48;
const PERIODS = 4; // ekranda görünen periyot sayısı
const PERIOD = W / PERIODS;
const HIGH = 10; // sinyal 1 iken y
const LOW = 38; // sinyal 0 iken y
const DUTY_MAX = 2 ** PWM_BITS - 1; // 8 bit için 255
const PERIOD_US = 1e6 / PWM_FREQ_HZ; // 5 kHz için 200 µs

// Akış için ekranın solunda bir periyot fazla çizilir; sağa kaydırınca boşluk kalmaz
function wavePath(duty: number) {
  let path = `M ${-PERIOD} ${LOW}`;
  for (let k = -1; k < PERIODS; k++) {
    const start = k * PERIOD;
    const off = start + duty * PERIOD; // sinyalin 0'a düştüğü nokta
    if (duty > 0) path += ` L ${start} ${HIGH} L ${off} ${HIGH}`;
    if (duty < 1) path += ` L ${off} ${LOW} L ${start + PERIOD} ${LOW}`;
  }
  return path;
}

function Bulb({ level }: { level: number }) {
  const glow = level / 100;
  return (
    <svg viewBox="0 0 28 28" className="pwm-bulb" aria-hidden="true">
      <circle cx="14" cy="12" r="13" fill="url(#pwm-bulb-glow)" className="fade" style={{ opacity: glow }} />
      <circle cx="14" cy="12" r="7" className="bulb-glass" />
      <circle cx="14" cy="12" r="7" className="bulb-light" style={{ opacity: glow }} />
      <rect x="10.5" y="18" width="7" height="5" rx="1.5" className="bulb-base" />
    </svg>
  );
}

export function PwmPanel({ lamps, running = true }: { lamps: number[]; running?: boolean }) {
  return (
    <div className={running ? "pwm" : "pwm still"}>
      {/* Satırların ortak kullandığı parlama efektleri */}
      <svg className="pwm-defs" aria-hidden="true">
        <defs>
          <filter id="pwm-glow" x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="pwm-bulb-glow">
            <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#f5c542" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <div className="pwm-head">
        <h2>PWM sinyalleri</h2>
        <span className="pwm-note">
          ESP32 LEDC · {PWM_FREQ_HZ / 1000} kHz · periyot {PERIOD_US} µs · {PWM_BITS} bit (0–{DUTY_MAX})
        </span>
      </div>

      {lamps.map((level, i) => {
        const duty = Math.round((level / 100) * DUTY_MAX);
        return (
          <div className="pwm-row" key={i}>
            <Bulb level={level} />
            <span className="pwm-label">Lamba {i + 1}</span>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="scope"
              role="img"
              aria-label={`Lamba ${i + 1} PWM sinyali, yüzde ${level}`}
            >
              {Array.from({ length: 7 }, (_, k) => (
                <line key={k} x1={(k + 1) * (W / 8)} x2={(k + 1) * (W / 8)} y1={0} y2={H} className="scope-grid" />
              ))}
              <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="scope-grid mid" />
              <g className="scope-flow">
                <path d={wavePath(level / 100)} className="scope-wave" filter="url(#pwm-glow)" />
              </g>
            </svg>
            <div className="pwm-duty">
              <div className="duty-bar">
                <div className="duty-fill" style={{ width: `${level}%` }} />
              </div>
              <span className="pwm-value">
                %{level} · {duty}/{DUTY_MAX}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
