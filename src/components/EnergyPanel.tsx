import type { SystemState } from "../logic/types";
import "./EnergyPanel.css";

interface Props {
  state: SystemState;
  energy: { smartWh: number; normalWh: number };
  onReset: () => void;
}

const formatWh = (wh: number) =>
  wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${wh.toFixed(1)} Wh`;

// Normal sistem hiç tüketmiyorsa (gündüz) tasarruf yüzdesi anlamsızdır
const savingPct = (smart: number, normal: number) =>
  normal > 0 ? (1 - smart / normal) * 100 : null;

export function EnergyPanel({ state, energy, onReset }: Props) {
  const instant = savingPct(state.powerW, state.normalPowerW);
  const total = savingPct(energy.smartWh, energy.normalWh);
  const smartRatio = energy.normalWh > 0 ? energy.smartWh / energy.normalWh : 0;

  return (
    <div className="energy">
      <div className="energy-head">
        <h2>Enerji</h2>
        <button onClick={onReset}>Sıfırla</button>
      </div>

      <div className="energy-grid">
        <div className="stat">
          <span className="stat-label">Anlık güç (akıllı)</span>
          <span className="stat-value">{state.powerW.toFixed(0)} W</span>
        </div>
        <div className="stat">
          <span className="stat-label">Anlık güç (normal)</span>
          <span className="stat-value muted">{state.normalPowerW.toFixed(0)} W</span>
        </div>
        <div className="stat">
          <span className="stat-label">Anlık tasarruf</span>
          <span className="stat-value good">
            {instant === null ? "—" : `%${instant.toFixed(0)}`}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Toplam tasarruf</span>
          <span className="stat-value good">
            {total === null ? "—" : `%${total.toFixed(1)}`}
          </span>
        </div>
      </div>

      <div className="bars">
        <div className="bar-row">
          <span>Normal</span>
          <div className="bar">
            <div
              className="bar-fill normal"
              style={{ width: energy.normalWh > 0 ? "100%" : "0%" }}
            />
          </div>
          <span>{formatWh(energy.normalWh)}</span>
        </div>
        <div className="bar-row">
          <span>Akıllı</span>
          <div className="bar">
            <div className="bar-fill smart" style={{ width: `${smartRatio * 100}%` }} />
          </div>
          <span>{formatWh(energy.smartWh)}</span>
        </div>
      </div>
    </div>
  );
}
