import { RoadView } from "./components/RoadView";
import { EnergyPanel } from "./components/EnergyPanel";
import { PwmPanel } from "./components/PwmPanel";
import { useMockSimulation } from "./hooks/useMockSimulation";
import "./App.css";

function App() {
  const sim = useMockSimulation();
  const { state } = sim;

  return (
    <main className="app">
      <header>
        <h1>Akıllı Sokak Aydınlatması</h1>
        <span className="badge">Kaynak: simülasyon</span>
      </header>

      <section className="panel">
        <RoadView state={state} />
      </section>

      <section className="panel controls">
        <button onClick={() => sim.spawn(5)}>🚶 Yaya gönder (5 km/s)</button>
        <button onClick={() => sim.spawn(50)}>🚗 Araç gönder (50 km/s)</button>
        <button onClick={() => sim.spawn(90)}>🚗 Hızlı araç (90 km/s)</button>
        <button onClick={() => sim.setNight(!state.isNight)}>
          {state.isNight ? "☀️ Gündüze geç" : "🌙 Geceye geç"}
        </button>
      </section>

      <section className="panel controls">
        <button onClick={() => sim.setPaused(!sim.paused)}>
          {sim.paused ? "▶️ Devam et" : "⏸️ Duraklat"}
        </button>
        <button
          onClick={sim.stepForward}
          disabled={!sim.paused}
          title="Duraklatılmışken nesneyi çeyrek lamba aralığı ilerletir"
        >
          ⏭️ Bir adım
        </button>
        {[1, 5, 10].map((scale) => (
          <button
            key={scale}
            className={sim.timeScale === scale ? "active" : ""}
            onClick={() => sim.setTimeScale(scale)}
          >
            {scale}x
          </button>
        ))}
        {sim.paused && (
          <span className="paused-note">Simülasyon duraklatıldı</span>
        )}
        {state.object && (
          <span className="sim-info">
            {state.object.type === "car" ? "Araç" : "Yaya"} ·{" "}
            {state.object.speedKmh} km/s · konum{" "}
            {state.object.position.toFixed(2)}
          </span>
        )}
      </section>

      <section className="panel">
        <EnergyPanel state={state} energy={sim.energy} onReset={sim.resetEnergy} />
      </section>

      <section className="panel">
        <PwmPanel lamps={state.lamps} />
      </section>
    </main>
  );
}

export default App;
