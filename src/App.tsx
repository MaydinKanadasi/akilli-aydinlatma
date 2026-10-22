import { RoadView } from "./components/RoadView";
import { EnergyPanel } from "./components/EnergyPanel";
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
      </section>

      <section className="panel">
        <EnergyPanel state={state} energy={sim.energy} onReset={sim.resetEnergy} />
      </section>
    </main>
  );
}

export default App;
