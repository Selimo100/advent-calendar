import type { HouseDesign } from './houses.ts';

const SNOW = '#f4f7fa';

function Ground() {
  return <path d="M-1 123 Q25 117 50 122 T101 123 V140 H-1Z" fill={SNOW} />;
}

function Fir({ x, scale = 1 }: { x: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${124 - 34 * scale}) scale(${scale})`}>
      <path d="M7 0 L14 13 H10 L16 24 H11 L17 34 H-3 L3 24 H-2 L4 13 H0 Z" fill="#1f4a3f" />
      <path d="M7 0 L10 6 L7 5 L4 6Z M3 13 L7 11 L11 13 M2 24 L7 21 L12 24" fill={SNOW} opacity="0.9" />
      <rect x="5.5" y="34" width="3" height="3" fill="#3d3128" />
    </g>
  );
}

function Roof({ design, top }: { design: HouseDesign; top: number }) {
  const T = top;
  switch (design.roof) {
    case 'steep':
      return (
        <>
          <path d={`M10 ${T + 1} L50 ${T - 50} L90 ${T + 1}Z`} fill={design.roofColor} />
          <path d={`M12 ${T - 1} L50 ${T - 48} L88 ${T - 1}`} stroke={SNOW} strokeWidth="5" strokeLinejoin="round" fill="none" />
          <circle cx="50" cy={T - 22} r="6" className="win" />
        </>
      );
    case 'dome':
      return (
        <>
          <path d={`M10 ${T + 1} Q50 ${T - 62} 90 ${T + 1}Z`} fill={design.roofColor} />
          <path d={`M13 ${T - 2} Q50 ${T - 58} 87 ${T - 2}`} stroke={SNOW} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d={`M50 ${T - 31} v-9`} stroke="#d5b477" strokeWidth="2" />
          <circle cx="50" cy={T - 42} r="2.6" fill="#d5b477" />
        </>
      );
    case 'stepped':
      return (
        <>
          <path
            d={`M12 ${T + 1} V${T - 10} H22 V${T - 20} H32 V${T - 30} H42 V${T - 40} H58 V${T - 30} H68 V${T - 20} H78 V${T - 10} H88 V${T + 1}Z`}
            fill={design.wall}
          />
          <path
            d={`M12 ${T - 10} H22 M22 ${T - 20} H32 M32 ${T - 30} H42 M42 ${T - 40} H58 M58 ${T - 30} H68 M68 ${T - 20} H78 M78 ${T - 10} H88`}
            stroke={SNOW}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect x="44" y={T - 26} width="12" height="14" rx="6" className="win" />
        </>
      );
    case 'hip':
      return (
        <>
          <path d={`M8 ${T + 1} L26 ${T - 26} H74 L92 ${T + 1}Z`} fill={design.roofColor} />
          <path d={`M11 ${T - 2} L27 ${T - 25} H73 L89 ${T - 2}`} stroke={SNOW} strokeWidth="5" strokeLinejoin="round" fill="none" />
          <rect x="42" y={T - 18} width="16" height="11" rx="2" className="win" />
        </>
      );
    case 'gable':
    default:
      return (
        <>
          <path d={`M8 ${T + 1} L50 ${T - 38} L92 ${T + 1}Z`} fill={design.roofColor} />
          <path d={`M10 ${T - 1} L50 ${T - 37} L90 ${T - 1}`} stroke={SNOW} strokeWidth="5" strokeLinejoin="round" fill="none" />
          <circle cx="50" cy={T - 14} r="5" className="win" />
        </>
      );
  }
}

/** Decorative house illustration (the door itself is an HTML layer). */
export function HouseArt({ design }: { design: HouseDesign }) {
  const top = design.tall ? 62 : 76;
  return (
    <svg className="house-svg" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
      {design.chimney && (
        <>
          <rect x="66" y={top - 34} width="9" height="22" fill="#4b3a32" />
          <rect x="65" y={top - 36} width="11" height="4" rx="1.5" fill={SNOW} />
          <circle cx="72" cy={top - 42} r="3" fill={SNOW} opacity="0.18" />
          <circle cx="77" cy={top - 49} r="4" fill={SNOW} opacity="0.12" />
        </>
      )}
      <rect x="14" y={top} width="72" height={124 - top} fill={design.wall} />
      <rect x="14" y={top} width="72" height="3" fill="#000" opacity="0.18" />
      <Roof design={design} top={top} />
      {design.tall && (
        <>
          <rect x="24" y={top + 8} width="13" height="15" rx="1.5" className="win" />
          <rect x="63" y={top + 8} width="13" height="15" rx="1.5" className="win" />
          <path d={`M30.5 ${top + 8} v15 M24 ${top + 15.5} h13 M69.5 ${top + 8} v15 M63 ${top + 15.5} h13`} stroke={design.wall} strokeWidth="1.4" />
          <rect x="22" y={top + 23} width="17" height="3" rx="1.5" fill={SNOW} />
          <rect x="61" y={top + 23} width="17" height="3" rx="1.5" fill={SNOW} />
        </>
      )}
      {design.sideWindows && (
        <>
          <rect x="19" y="96" width="10" height="12" rx="1" className="win" />
          <rect x="71" y="96" width="10" height="12" rx="1" className="win" />
        </>
      )}
      {/* door surround */}
      <path d="M31 124 V96 Q31 85 50 85 Q69 85 69 96 V124Z" fill="#000" opacity="0.28" />
      <Ground />
      <rect x="30" y="122" width="40" height="3" rx="1.5" fill="#dfe6ec" />
      {design.tree === 'left' && <Fir x={-2} scale={0.95} />}
      {design.tree === 'right' && <Fir x={86} scale={0.95} />}
    </svg>
  );
}

export function GrandHouseArt() {
  return (
    <svg className="house-svg" viewBox="0 0 300 160" aria-hidden="true" focusable="false">
      {/* side wings */}
      <rect x="60" y="88" width="180" height="58" fill="#3f2f2c" />
      <path d="M52 89 L95 58 H205 L248 89Z" fill="#5e2430" />
      <path d="M55 87 L96 59 H204 L245 87" stroke={SNOW} strokeWidth="6" strokeLinejoin="round" fill="none" />
      {/* tower */}
      <rect x="122" y="40" width="56" height="106" fill="#4a3633" />
      <path d="M116 42 L150 2 L184 42Z" fill="#2a2f35" />
      <path d="M119 40 L150 4 L181 40" stroke={SNOW} strokeWidth="5" strokeLinejoin="round" fill="none" />
      <path d="M150 2 v-6" stroke="#d5b477" strokeWidth="2" />
      <path d="M150 -12 l2.4 5 5.4.6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6z" fill="#ebd29f" />
      <circle cx="150" cy="62" r="11" className="win" />
      <path d="M150 54 v8 l5 4" stroke="#4a3633" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* windows */}
      {[72, 96, 186, 210].map((x) => (
        <g key={x}>
          <rect x={x} y="100" width="16" height="20" rx="8" className="win" />
          <rect x={x - 2} y="120" width="20" height="3" rx="1.5" fill={SNOW} />
        </g>
      ))}
      {/* garland */}
      <path d="M124 92 Q137 102 150 92 Q163 102 176 92" stroke="#1f4a3f" strokeWidth="4" fill="none" strokeLinecap="round" />
      {[130, 143, 157, 170].map((x) => (
        <circle key={x} cx={x} cy={x === 130 || x === 170 ? 96 : 99} r="1.8" fill="#d5b477" />
      ))}
      <path d="M126 146 V112 Q126 98 150 98 Q174 98 174 112 V146Z" fill="#000" opacity="0.3" />
      <path d="M0 145 Q60 136 150 143 T300 144 V160 H0Z" fill={SNOW} />
      <g transform="translate(14 0)"><Fir x={0} scale={1.1} /></g>
      <g transform="translate(28 4)"><Fir x={0} scale={0.85} /></g>
      <g transform="translate(252 0)"><Fir x={0} scale={1.1} /></g>
      <g transform="translate(268 4)"><Fir x={0} scale={0.8} /></g>
    </svg>
  );
}

export function TreeGroveArt() {
  return (
    <svg className="house-svg" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
      <Fir x={12} scale={1.25} />
      <Fir x={44} scale={1.55} />
      <Fir x={74} scale={1.05} />
      <rect x="83" y="96" width="2.5" height="28" fill="#2a2f35" />
      <rect x="79.5" y="88" width="9.5" height="10" rx="2" fill="#2a2f35" />
      <rect x="81.5" y="90" width="5.5" height="6" rx="1" fill="#ffcf7a" />
      <Ground />
    </svg>
  );
}
