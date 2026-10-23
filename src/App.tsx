import { useState } from "react";
import { RoadView } from "./components/RoadView";
import { EnergyPanel } from "./components/EnergyPanel";
import { PwmPanel } from "./components/PwmPanel";
import { useMockSimulation } from "./hooks/useMockSimulation";
import { DEFAULT_CONFIG, classifyBySpeed } from "./logic/controller";
import "./App.css";

function App() {
  const sim = useMockSimulation();
  const { state } = sim;
  const [speed, setSpeed] = useState(50);
  const speedType = classifyBySpeed(speed);

  // Hazır butonlar kaydırıcıyı da aynı hıza getirir
  const send = (kmh: number) => {
    setSpeed(kmh);
    sim.spawn(kmh);
  };

  // Kaydırıcı oynatılınca yoldaki nesnenin hızı da anında değişir
  const changeSpeed = (kmh: number) => {
    setSpeed(kmh);
    sim.setObjectSpeed(kmh);
  };

  return (
    <main className="app">
      <header>
        <h1>Akıllı Sokak Aydınlatması</h1>
        <span className="badge">Kaynak: simülasyon</span>
      </header>

      <section className="panel">
        <RoadView
          state={state}
          onDrag={sim.moveObjectTo}
          onDraggingChange={sim.setDragging}
          moving={!sim.paused}
        />
        <p className="hint">
          İpucu: Yolda bir nesne varken yolun herhangi bir yerine tıklayıp sürükleyerek onu taşıyabilirsin.
        </p>
      </section>

      <section className="panel controls">
        <label className="speed">
          <span>Hız</span>
          <input
            type="range"
            min={1}
            max={120}
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
          />
          <strong>{speed} km/s</strong>
        </label>
        <span className="speed-type">
          {speedType === "car" ? "🚗 Araç" : "🚶 Yaya"} (eşik{" "}
          {DEFAULT_CONFIG.pedestrianMaxKmh} km/s)
        </span>
        <button onClick={() => send(speed)}>Bu hızla gönder</button>
      </section>

      <section className="panel controls">
        <button onClick={() => send(5)}>🚶 Yaya (5 km/s)</button>
        <button onClick={() => send(50)}>🚗 Araç (50 km/s)</button>
        <button onClick={() => send(90)}>🚗 Hızlı araç (90 km/s)</button>
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
