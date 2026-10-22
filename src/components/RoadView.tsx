import type { SystemState } from "../logic/types";
import "./RoadView.css";

const ROAD_TOP = 180;
const lampX = (n: number) => 120 + (n - 1) * 120; // n. lambanın (ya da konumun) x koordinatı

export function RoadView({ state }: { state: SystemState }) {
  const { lamps, object, isNight } = state;

  return (
    <svg
      className={`road ${isNight ? "night" : "day"}`}
      viewBox="0 0 720 260"
      role="img"
      aria-label="Yol ve sokak lambaları"
    >
      <rect width="720" height={ROAD_TOP} className="sky" />
      <rect y={ROAD_TOP} width="720" height="60" className="asphalt" />
      <line
        x1="0"
        y1={ROAD_TOP + 30}
        x2="720"
        y2={ROAD_TOP + 30}
        className="lane"
      />

      {lamps.map((level, i) => {
        const x = lampX(i + 1);
        const glow = level / 100;
        return (
          <g key={i}>
            <polygon
              points={`${x},70 ${x - 55},${ROAD_TOP + 60} ${x + 55},${ROAD_TOP + 60}`}
              className="beam"
              style={{ opacity: glow * 0.45 }}
            />
            <line
              x1={x - 20}
              y1={ROAD_TOP}
              x2={x - 20}
              y2={60}
              className="pole"
            />
            <line x1={x - 20} y1={60} x2={x} y2={60} className="pole" />
            <circle
              cx={x}
              cy={66}
              r={7}
              className="bulb"
              style={{ opacity: 0.2 + glow * 0.8 }}
            />
            <text x={x} y={40} className="level">
              %{level}
            </text>
            <text x={x} y={256} className="lamp-no">
              {i + 1}
            </text>
          </g>
        );
      })}

      {object && object.type === "car" && (
        <g transform={`translate(${lampX(object.position)}, ${ROAD_TOP + 42})`}>
          <rect x={-12} y={-18} width={22} height={9} rx={3} className="car" />
          <rect x={-22} y={-10} width={44} height={16} rx={4} className="car" />
          <circle cx={-12} cy={7} r={4} className="wheel" />
          <circle cx={12} cy={7} r={4} className="wheel" />
        </g>
      )}

      {object && object.type === "pedestrian" && (
        <g
          transform={`translate(${lampX(object.position)}, ${ROAD_TOP + 22})`}
          className="person"
        >
          <circle cy={-24} r={4} className="person-head" />
          <line y1={-19} y2={-8} />
          <line x1={-5} y1={-15} x2={5} y2={-15} />
          <line y1={-8} x2={-5} y2={0} />
          <line y1={-8} x2={5} y2={0} />
        </g>
      )}
    </svg>
  );
}
