import type { HistorySample } from "../logic/types";
import { DEFAULT_CONFIG, LAMP_COUNT } from "../logic/controller";
import { LineChart } from "./LineChart";
import "./ChartsPanel.css";

const LAMP_COLORS = ["#f5c542", "#4ade80", "#4f8cff", "#ff9f43", "#c084fc"];

export function ChartsPanel({ history }: { history: HistorySample[] }) {
  const times = history.map((h) => h.t);

  return (
    <div className="charts">
      <h2>Zaman grafikleri</h2>
      <div className="charts-grid">
        <LineChart
          title="Anlık güç (W)"
          unit="W"
          times={times}
          yMax={LAMP_COUNT * DEFAULT_CONFIG.lampPowerW}
          band
          series={[
            { name: "Normal", color: "#8b94ab", values: history.map((h) => h.normalPowerW) },
            { name: "Akıllı", color: "#4ade80", values: history.map((h) => h.powerW) },
          ]}
        />
        <LineChart
          title="Lamba parlaklıkları (%)"
          unit="%"
          times={times}
          yMax={100}
          series={LAMP_COLORS.map((color, i) => ({
            name: `Lamba ${i + 1}`,
            color,
            values: history.map((h) => h.lamps[i]),
          }))}
        />
      </div>
      <p className="charts-note">
        Son ~30 saniye gösterilir; zaman ekseni simülasyon saniyesidir. Fareyle grafiğin üzerinde gezinerek o anki değerleri görebilirsin.
      </p>
    </div>
  );
}
