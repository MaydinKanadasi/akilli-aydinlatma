import "./PwmPanel.css";

const PERIODS = 4; // her satırda kaç PWM periyodu çizilecek
const W = 400;
const H = 36;
const HIGH = 6;  // sinyal 1 iken y
const LOW = 30;  // sinyal 0 iken y

// Duty cycle'a (0–1) göre kare dalga çizgisi üretir
function wavePath(duty: number) {
  const period = W / PERIODS;
  let path = `M 0 ${LOW}`;
  for (let k = 0; k < PERIODS; k++) {
    const start = k * period;
    const off = start + duty * period; // sinyalin 0'a düştüğü nokta
    if (duty > 0) path += ` L ${start} ${HIGH} L ${off} ${HIGH}`;
    if (duty < 1) path += ` L ${off} ${LOW} L ${start + period} ${LOW}`;
  }
  return path;
}

export function PwmPanel({ lamps }: { lamps: number[] }) {
  return (
    <div className="pwm">
      <div className="pwm-head">
        <h2>PWM sinyalleri</h2>
        <span className="pwm-note">ESP32 LEDC · 8 bit (0–255)</span>
      </div>

      {lamps.map((level, i) => (
        <div className="pwm-row" key={i}>
          <span className="pwm-label">Lamba {i + 1}</span>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="pwm-wave"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Lamba ${i + 1} PWM sinyali, yüzde ${level}`}
          >
            <path d={wavePath(level / 100)} />
          </svg>
          <span className="pwm-value">
            %{level} · {Math.round((level / 100) * 255)}
          </span>
        </div>
      ))}
    </div>
  );
}
