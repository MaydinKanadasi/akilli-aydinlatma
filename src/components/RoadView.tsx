import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { SystemState, TrackedObject } from "../logic/types";
import "./RoadView.css";

const VIEW_W = 720;
const VIEW_H = 300;
const SIDEWALK_TOP = 170; // üst kaldırım
const ROAD_TOP = 190;
const ROAD_BOTTOM = 260;
const LANE_Y = (ROAD_TOP + ROAD_BOTTOM) / 2;
const LAMP_GAP = 120; // çizimde iki lamba arası mesafe
const lampX = (n: number) => LAMP_GAP * n; // n. lambanın (ya da konumun) x koordinatı

// Yıldızlar her çizimde aynı yerde dursun diye sabit bir formülle üretilir
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 137.5) % VIEW_W,
  y: ((i * 61.3) % 120) + 6,
  r: i % 5 === 0 ? 1.4 : 0.8,
  delay: (i % 7) * 0.45,
}));

interface Props {
  state: SystemState;
  onDrag?: (position: number) => void; // sürüklenen nesnenin yeni konumu (lamba cinsinden)
  onDraggingChange?: (dragging: boolean) => void;
  moving?: boolean; // false ise yürüme/tekerlek animasyonları durur
}

function Lamp({ n, level }: { n: number; level: number }) {
  const x = lampX(n);
  const glow = level / 100;
  return (
    <g>
      {/* Yoldaki ışık halkası ve aşağı doğru solan ışık konisi */}
      <ellipse cx={x} cy={LANE_Y - 8} rx={85} ry={34} fill="url(#pool)" className="fade" style={{ opacity: glow }} />
      <polygon
        points={`${x - 6},62 ${x + 6},62 ${x + 70},${ROAD_BOTTOM - 16} ${x - 70},${ROAD_BOTTOM - 16}`}
        fill="url(#beam)"
        className="fade"
        style={{ opacity: glow * 0.8 }}
      />
      <path d={`M ${x - 24} ${SIDEWALK_TOP + 8} V 62 Q ${x - 24} 54 ${x - 16} 54 H ${x - 4}`} className="pole" />
      <path d={`M ${x - 11} 52 H ${x + 11} L ${x + 6} 61 H ${x - 6} Z`} className="fixture" />
      <circle cx={x} cy={63} r={24} fill="url(#glow)" className="fade" style={{ opacity: glow }} />
      <ellipse cx={x} cy={62} rx={5} ry={2} className="bulb" style={{ opacity: 0.25 + glow * 0.75 }} />
      <rect x={x - 21} y={18} width={42} height={20} rx={10} className={level > 0 ? "level-bg on" : "level-bg"} />
      <text x={x} y={32} className={level > 0 ? "level on" : "level"}>%{level}</text>
      <text x={x} y={VIEW_H - 8} className="lamp-no">{n}</text>
    </g>
  );
}

function Pedestrian({ object }: { object: TrackedObject }) {
  return (
    <g transform={`translate(${lampX(object.position)}, ${SIDEWALK_TOP + 15})`} className="person">
      <ellipse rx={7} ry={1.6} className="shadow" />
      {/* Bacaklar ve kollar zıt yönde sallanır */}
      <g transform="translate(0,-11)">
        <line y2={11} className="limb swing-a" />
        <line y2={11} className="limb swing-b" />
      </g>
      <line y1={-11} y2={-22} />
      <g transform="translate(0,-21)">
        <line y2={9} className="limb swing-b" />
        <line y2={9} className="limb swing-a" />
      </g>
      <circle cy={-26} r={3.6} className="person-head" />
    </g>
  );
}

function Car({ object, isNight }: { object: TrackedObject; isNight: boolean }) {
  // Tekerlekler hızla orantılı döner
  const spin = `${Math.min(Math.max(18 / object.speedKmh, 0.08), 1)}s`;
  return (
    <g transform={`translate(${lampX(object.position)}, ${ROAD_BOTTOM - 12})`}>
      {isNight && <polygon points="28,-13 110,-26 110,2" fill="url(#headlight)" />}
      <ellipse rx={30} ry={3} className="shadow" />
      <path
        d="M -29 -5 V -13 Q -29 -17 -24 -17 H -14 L -8 -26 H 10 L 18 -17 H 25 Q 30 -17 30 -12 V -5 Z"
        className="car-body"
      />
      <path d="M -12 -18 L -6.5 -24.5 H 0 V -18 Z" className="car-window" />
      <path d="M 2 -18 V -24.5 H 9.5 L 15 -18 Z" className="car-window" />
      <rect x={26} y={-15} width={4} height={3} rx={1} className={isNight ? "headlamp on" : "headlamp"} />
      <rect x={-29.5} y={-15} width={2.5} height={3} rx={1} className="taillamp" />
      {[-17, 17].map((wx) => (
        <g key={wx} transform={`translate(${wx}, -5)`}>
          <circle r={5.5} className="tire" />
          <circle r={2.6} className="hub" />
          <g className="spokes" style={{ animationDuration: spin }}>
            <line x1={-4} x2={4} />
            <line y1={-4} y2={4} />
          </g>
        </g>
      ))}
    </g>
  );
}

export function RoadView({ state, onDrag, onDraggingChange, moving = true }: Props) {
  const { lamps, object, isNight } = state;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  // Farenin ekrandaki x konumunu lamba cinsinden konuma çevirir (lampX'in tersi)
  const toPosition = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return (((clientX - rect.left) / rect.width) * VIEW_W) / LAMP_GAP;
  };

  // Yolun herhangi bir yerine basınca nesne oraya gelir ve sürükleme başlar
  const startDrag = (e: ReactPointerEvent<SVGRectElement>) => {
    const position = toPosition(e.clientX);
    if (!onDrag || position === null) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setDragging(true);
    onDraggingChange?.(true);
    onDrag(position);
  };

  const moveDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging || !onDrag) return;
    const position = toPosition(e.clientX);
    if (position !== null) onDrag(position);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    onDraggingChange?.(false);
  };

  const classes = [
    "road",
    isNight ? "night" : "day",
    dragging ? "dragging" : "",
    !moving || dragging ? "still" : "",
  ].join(" ");

  return (
    <svg
      ref={svgRef}
      className={classes}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Yol ve sokak lambaları"
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <defs>
        <linearGradient id="sky-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070f" />
          <stop offset="1" stopColor="#1a2238" />
        </linearGradient>
        <linearGradient id="sky-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fb8ee" />
          <stop offset="1" stopColor="#cfe9fb" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#f5c542" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pool">
          <stop offset="0" stopColor="#f5c542" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f5c542" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f5c542" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="headlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff4c2" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff4c2" stopOpacity="0" />
        </linearGradient>
        <pattern id="paving" width="28" height="20" patternUnits="userSpaceOnUse">
          <rect width="28" height="20" className="paving-tile" />
          <line x1="0" x2="0" y2="20" className="paving-joint" />
        </pattern>
      </defs>

      {/* Gökyüzü */}
      <rect width={VIEW_W} height={SIDEWALK_TOP} fill={isNight ? "url(#sky-night)" : "url(#sky-day)"} />
      {isNight ? (
        <>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} className="star" style={{ animationDelay: `${s.delay}s` }} />
          ))}
          <circle cx={668} cy={42} r={14} className="moon" />
          <circle cx={663} cy={38} r={2.5} className="crater" />
          <circle cx={672} cy={47} r={3} className="crater" />
          <circle cx={671} cy={35} r={1.5} className="crater" />
        </>
      ) : (
        <>
          <circle cx={668} cy={42} r={32} fill="url(#glow)" opacity={0.6} />
          <circle cx={668} cy={42} r={14} className="sun" />
          <g className="cloud">
            <ellipse cx={70} cy={45} rx={26} ry={9} />
            <ellipse cx={86} cy={38} rx={16} ry={10} />
          </g>
          <g className="cloud">
            <ellipse cx={400} cy={30} rx={30} ry={9} />
            <ellipse cx={418} cy={23} rx={17} ry={9} />
          </g>
        </>
      )}

      {/* Kaldırımlar ve yol */}
      <rect y={SIDEWALK_TOP} width={VIEW_W} height={ROAD_TOP - SIDEWALK_TOP} fill="url(#paving)" />
      <rect y={ROAD_TOP} width={VIEW_W} height={ROAD_BOTTOM - ROAD_TOP} className="asphalt" />
      <rect y={ROAD_TOP - 3} width={VIEW_W} height={3} className="curb" />
      <rect y={ROAD_BOTTOM} width={VIEW_W} height={14} fill="url(#paving)" />
      <rect y={ROAD_BOTTOM} width={VIEW_W} height={3} className="curb" />
      <line x1="0" y1={ROAD_TOP + 5} x2={VIEW_W} y2={ROAD_TOP + 5} className="edge" />
      <line x1="0" y1={ROAD_BOTTOM - 5} x2={VIEW_W} y2={ROAD_BOTTOM - 5} className="edge" />
      <line x1="0" y1={LANE_Y} x2={VIEW_W} y2={LANE_Y} className="lane" />

      {lamps.map((level, i) => (
        <Lamp key={i} n={i + 1} level={level} />
      ))}

      {object?.type === "car" && <Car object={object} isNight={isNight} />}
      {object?.type === "pedestrian" && <Pedestrian object={object} />}

      {/* Kaldırımı ve yolu kaplayan görünmez tutma alanı */}
      {object && onDrag && (
        <rect
          y={SIDEWALK_TOP - 30}
          width={VIEW_W}
          height={ROAD_BOTTOM - SIDEWALK_TOP + 44}
          fill="transparent"
          className="drag-zone"
          onPointerDown={startDrag}
        />
      )}
    </svg>
  );
}
