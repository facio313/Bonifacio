/* Tiny abstract SVG visual per card — never literal.
   Known showcase ids render a bespoke graphic; everything else (real apps)
   falls back to a clean monogram tile built from the app's icon + color. */

interface FallbackInfo {
  icon?: string
  label?: string
  color?: string
}

interface Props {
  kind?: string
  accent: string
  fallback?: FallbackInfo
}

const mono = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  fill: 'rgba(11,11,13,0.45)',
  letterSpacing: '0.1em',
} as const

export const CardVisual = ({ kind, accent, fallback }: Props) => {
  const stroke = 'rgba(11,11,13,0.85)'
  const bg = '#ffffff'

  if (kind === 'pilgrimage') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#f3f1ec" />
        {/* faint map contours */}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M0 ${50 + i * 38} Q 80 ${36 + i * 38} 160 ${50 + i * 38} T 320 ${50 + i * 38}`}
            fill="none"
            stroke={stroke}
            strokeOpacity="0.07"
          />
        ))}
        {/* travelled route */}
        <path
          d="M28 174 C 96 150 70 104 142 96 S 232 70 284 44"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        {/* waypoints */}
        <circle cx="28" cy="174" r="5" fill={stroke} />
        <circle cx="142" cy="96" r="4" fill="#fff" stroke={stroke} strokeOpacity="0.7" />
        {/* destination pin */}
        <g transform="translate(284 44)">
          <path
            d="M0 0 C 9 0 13 -7 13 -13 C 13 -22 0 -34 0 -34 C 0 -34 -13 -22 -13 -13 C -13 -7 -9 0 0 0 Z"
            fill={accent}
          />
          <circle cx="0" cy="-15" r="5" fill="#fff" />
        </g>
        <text x="20" y="32" {...mono}>
          01 / PILGRIMAGE
        </text>
        <text
          x="20"
          y="178"
          style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, fill: stroke }}
        >
          journey
        </text>
      </svg>
    )
  }
  if (kind === 'garak') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#101114" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M-24 ${82 + i * 18} C 44 ${34 + i * 17} 84 ${142 + i * 8} 150 ${94 + i * 12} S 258 ${52 + i * 16} 344 ${98 + i * 13}`}
            fill="none"
            stroke={i === 2 ? accent : '#fff'}
            strokeOpacity={i === 2 ? 0.95 : 0.13 + i * 0.025}
            strokeWidth={i === 2 ? 2.4 : 1}
          />
        ))}
        <path
          d="M46 122 C 82 94 102 91 133 111 S 187 136 219 92 S 265 64 290 79"
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        <circle cx="46" cy="122" r="4" fill="#fff" />
        <circle cx="133" cy="111" r="6" fill={accent} />
        <circle cx="219" cy="92" r="4" fill="#fff" fillOpacity="0.8" />
        <circle cx="290" cy="79" r="3" fill={accent} />
        <text x="20" y="32" {...mono} fill="rgba(255,255,255,0.55)">
          GARAK / FLOW
        </text>
        <text
          x="20"
          y="178"
          style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, fill: '#fff' }}
        >
          cadence
        </text>
      </svg>
    )
  }
  if (kind === 'feelmyrythm') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#f4efe4" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="18"
            x2="302"
            y1={64 + i * 13}
            y2={64 + i * 13}
            stroke={stroke}
            strokeOpacity="0.12"
          />
        ))}
        <g transform="translate(48 69)">
          <line x1="12" y1="0" x2="12" y2="48" stroke={stroke} strokeWidth="2" />
          <ellipse cx="5" cy="48" rx="8" ry="5.5" transform="rotate(-16 5 48)" fill={accent} />
          <line x1="56" y1="-8" x2="56" y2="35" stroke={stroke} strokeWidth="2" />
          <ellipse cx="49" cy="35" rx="8" ry="5.5" transform="rotate(-16 49 35)" fill={stroke} />
        </g>
        <g transform="translate(194 48)">
          <path d="M34 0 L68 104 H0 Z" fill="#fff" stroke={stroke} strokeOpacity="0.72" />
          <path d="M34 17 L50 88 H18 Z" fill={accent} fillOpacity="0.12" />
          <line x1="34" y1="21" x2="57" y2="72" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <circle cx="57" cy="72" r="5" fill={accent} />
          <rect x="10" y="101" width="48" height="7" rx="3.5" fill={stroke} />
        </g>
        <path
          d="M20 157 H54 L62 145 L72 170 L84 151 L93 157 H166"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="20" y="32" {...mono}>
          FEEL MY RYTHM / SYNC
        </text>
      </svg>
    )
  }
  if (kind === 'multtara') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#f1eef8" />
        <circle cx="264" cy="42" r="54" fill={accent} fillOpacity="0.08" />
        <circle cx="264" cy="42" r="34" fill="none" stroke={accent} strokeOpacity="0.22" />
        <g transform="translate(44 54)">
          <rect x="0" y="28" width="178" height="92" rx="14" fill="#fff" stroke={stroke} strokeOpacity="0.22" />
          <rect x="18" y="14" width="178" height="92" rx="14" fill="#fff" stroke={stroke} strokeOpacity="0.36" />
          <rect x="36" y="0" width="178" height="92" rx="14" fill="#fff" stroke={stroke} strokeOpacity="0.72" />
          <circle cx="54" cy="18" r="4" fill={accent} />
          <circle cx="68" cy="18" r="4" fill={stroke} fillOpacity="0.18" />
          <circle cx="82" cy="18" r="4" fill={stroke} fillOpacity="0.18" />
          <rect x="54" y="38" width="56" height="36" rx="6" fill={accent} fillOpacity="0.14" />
          <rect x="120" y="38" width="76" height="7" rx="3.5" fill={stroke} fillOpacity="0.22" />
          <rect x="120" y="53" width="54" height="7" rx="3.5" fill={stroke} fillOpacity="0.12" />
          <rect x="120" y="68" width="67" height="7" rx="3.5" fill={accent} fillOpacity="0.62" />
        </g>
        <path d="M273 33 L277 42 L286 46 L277 50 L273 59 L269 50 L260 46 L269 42 Z" fill={accent} />
        <text x="20" y="32" {...mono}>
          MULTTARA / NEXT
        </text>
        <text x="238" y="178" textAnchor="end" {...mono} fill={accent}>
          BUILDING
        </text>
      </svg>
    )
  }
  if (kind === 'vue') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#edf4f0" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={`v-${i}`}
            d={`M${34 + i * 58} 42 L${12 + i * 58} 184`}
            stroke={stroke}
            strokeOpacity="0.08"
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={`h-${i}`}
            d={`M0 ${62 + i * 38} Q 78 ${48 + i * 40} 158 ${64 + i * 38} T 320 ${58 + i * 40}`}
            fill="none"
            stroke={stroke}
            strokeOpacity="0.09"
          />
        ))}
        <path
          d="M59 139 L91 69 L167 55 L241 91 L217 151 L135 166 Z"
          fill={accent}
          fillOpacity="0.14"
          stroke={accent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M91 69 L135 166 M167 55 L217 151 M59 139 L241 91" fill="none" stroke={accent} strokeOpacity="0.28" />
        {[
          [59, 139],
          [91, 69],
          [167, 55],
          [241, 91],
          [217, 151],
          [135, 166],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 2 ? 6 : 3.5} fill={i === 2 ? accent : '#fff'} stroke={accent} />
        ))}
        <rect x="252" y="126" width="48" height="52" rx="8" fill="#fff" stroke={stroke} strokeOpacity="0.18" />
        <line x1="264" y1="142" x2="288" y2="142" stroke={accent} strokeWidth="3" />
        <line x1="264" y1="153" x2="282" y2="153" stroke={stroke} strokeOpacity="0.25" />
        <line x1="264" y1="164" x2="291" y2="164" stroke={stroke} strokeOpacity="0.16" />
        <text x="20" y="32" {...mono}>
          VUE / SPATIAL LAYERS
        </text>
      </svg>
    )
  }
  if (kind === 'dukkeobi') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#f3f1e9" />
        <path d="M0 66 L320 134 M0 150 L320 72 M72 0 L112 200 M232 0 L190 200" stroke={stroke} strokeOpacity="0.07" />
        {[24, 80, 246].map((x, i) => (
          <rect
            key={x}
            x={x}
            y={i === 1 ? 122 : 104}
            width={i === 1 ? 44 : 50}
            height={i === 1 ? 46 : 62}
            rx="4"
            fill={stroke}
            fillOpacity={i === 1 ? 0.08 : 0.05}
          />
        ))}
        <g transform="translate(112 48)">
          <path d="M48 0 L96 37 V100 H0 V37 Z" fill="#fff" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M17 42 L48 17 L79 42" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="36" y="58" width="24" height="42" rx="3" fill={accent} fillOpacity="0.16" stroke={accent} />
          <circle cx="54" cy="79" r="2" fill={accent} />
        </g>
        <g transform="translate(243 47)">
          <path d="M19 0 C31 0 38 9 38 19 C38 34 19 52 19 52 C19 52 0 34 0 19 C0 9 7 0 19 0 Z" fill={accent} />
          <path d="M12 19 L17 24 L27 13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x="20" y="32" {...mono}>
          DUKKEOBI / SAFE HOME
        </text>
      </svg>
    )
  }
  if (kind === 'ddit-finalproject') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#121417" />
        <g transform="translate(34 51)">
          <rect x="18" y="0" width="232" height="126" rx="10" fill="#1d2025" stroke="rgba(255,255,255,0.2)" />
          <rect x="0" y="16" width="232" height="126" rx="10" fill="#fff" />
          <path d="M0 28 Q0 16 12 16 H220 Q232 16 232 28 V42 H0 Z" fill="#ececef" />
          <circle cx="16" cy="29" r="3" fill={accent} />
          <circle cx="27" cy="29" r="3" fill={stroke} fillOpacity="0.18" />
          <circle cx="38" cy="29" r="3" fill={stroke} fillOpacity="0.18" />
          <rect x="16" y="57" width="52" height="66" rx="5" fill={accent} fillOpacity="0.12" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(82 ${58 + i * 22})`}>
              <rect width="12" height="12" rx="3" fill={i === 1 ? accent : stroke} fillOpacity={i === 1 ? 0.9 : 0.13} />
              <rect x="21" y="1" width={i === 0 ? 98 : i === 1 ? 76 : 112} height="4" rx="2" fill={stroke} fillOpacity="0.34" />
              <rect x="21" y="9" width={i === 0 ? 64 : i === 1 ? 105 : 82} height="3" rx="1.5" fill={stroke} fillOpacity="0.11" />
            </g>
          ))}
        </g>
        <text x="20" y="32" {...mono} fill="rgba(255,255,255,0.55)">
          DDIT / TEAM ARCHIVE
        </text>
        <rect x="261" y="157" width="39" height="20" rx="10" fill={accent} />
        <text x="280.5" y="170.5" textAnchor="middle" style={{ ...mono, fontSize: 7, fill: '#fff' }}>
          READ
        </text>
      </svg>
    )
  }
  if (kind === 'react') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#eef5f7" />
        <g stroke={stroke} strokeOpacity="0.16" fill="none">
          <path d="M78 101 H129" />
          <path d="M191 101 H242" />
          <path d="M160 72 V48" />
          <path d="M160 130 V158" />
          <path d="M113 76 L80 52" />
          <path d="M207 76 L240 52" />
          <path d="M113 126 L80 151" />
          <path d="M207 126 L240 151" />
        </g>
        {[
          [61, 101, 34, 22],
          [259, 101, 34, 22],
          [160, 37, 44, 21],
          [160, 167, 50, 21],
          [65, 42, 28, 18],
          [255, 42, 28, 18],
          [65, 158, 28, 18],
          [255, 158, 28, 18],
        ].map(([cx, cy, width, height], i) => (
          <rect
            key={i}
            x={cx - width / 2}
            y={cy - height / 2}
            width={width}
            height={height}
            rx="5"
            fill="#fff"
            stroke={i < 2 ? accent : stroke}
            strokeOpacity={i < 2 ? 0.8 : 0.22}
          />
        ))}
        <g transform="translate(160 101)">
          <ellipse rx="47" ry="18" fill="none" stroke={accent} strokeWidth="2" />
          <ellipse rx="47" ry="18" fill="none" stroke={accent} strokeWidth="2" transform="rotate(60)" />
          <ellipse rx="47" ry="18" fill="none" stroke={accent} strokeWidth="2" transform="rotate(120)" />
          <circle r="7" fill={accent} />
        </g>
        <text x="20" y="32" {...mono}>
          REACT / COMPONENTS
        </text>
      </svg>
    )
  }
  if (kind === 'orbit') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#0b0b0d" />
        <g transform="translate(160 100)">
          <ellipse cx="0" cy="0" rx="120" ry="34" fill="none" stroke="rgba(255,255,255,0.18)" />
          <ellipse cx="0" cy="0" rx="80" ry="22" fill="none" stroke="rgba(255,255,255,0.28)" />
          <ellipse cx="0" cy="0" rx="40" ry="12" fill="none" stroke="rgba(255,255,255,0.45)" />
          <circle cx="0" cy="0" r="10" fill={accent} />
          <circle cx="80" cy="0" r="3" fill="#fff" />
          <circle cx="-40" cy="0" r="2" fill="#fff" opacity="0.6" />
          <circle cx="120" cy="0" r="4" fill={accent} />
        </g>
        <text x="20" y="32" {...mono} fill="rgba(255,255,255,0.55)">
          02 / ORBIT
        </text>
        <text
          x="20"
          y="178"
          style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, fill: '#fff' }}
        >
          scheduling
        </text>
      </svg>
    )
  }
  if (kind === 'inkwell') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill={bg} />
        {[...Array(12)].map((_, i) => (
          <line
            key={i}
            x1="20"
            x2="300"
            y1={70 + i * 9}
            y2={70 + i * 9}
            stroke={stroke}
            strokeOpacity={i % 4 === 0 ? 0.7 : 0.12}
          />
        ))}
        <rect x="220" y="64" width="80" height="22" fill={accent} />
        <text x="20" y="32" {...mono}>
          03 / INKWELL
        </text>
      </svg>
    )
  }
  if (kind === 'tide') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#f3f1ec" />
        <path d="M0 130 Q 80 100 160 130 T 320 130 L 320 200 L 0 200 Z" fill={accent} fillOpacity="0.92" />
        <path d="M0 150 Q 80 120 160 150 T 320 150" fill="none" stroke="rgba(11,11,13,0.5)" />
        <path d="M0 170 Q 80 140 160 170 T 320 170" fill="none" stroke="rgba(11,11,13,0.3)" />
        <text x="20" y="32" {...mono}>
          04 / TIDE
        </text>
      </svg>
    )
  }
  if (kind === 'glyph') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill={bg} />
        <text
          x="160"
          y="150"
          textAnchor="middle"
          style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 160, fill: stroke }}
        >
          Aa
        </text>
        <rect x="20" y="170" width="40" height="10" fill={accent} />
        <text x="20" y="32" {...mono}>
          05 / GLYPH
        </text>
      </svg>
    )
  }
  if (kind === 'pocket') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill={bg} />
        <g transform="translate(40 50)">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 16}
              y={i * 8}
              width="160"
              height="90"
              rx="10"
              fill="#fff"
              stroke={stroke}
              strokeOpacity="0.5"
            />
          ))}
          <rect x="64" y="24" width="160" height="90" rx="10" fill={accent} />
        </g>
        <text x="20" y="32" {...mono}>
          06 / POCKET
        </text>
      </svg>
    )
  }
  if (kind === 'sift') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill={bg} />
        {[...Array(14)].map((_, i) => (
          <rect
            key={i}
            x={20 + i * 9}
            y={60}
            width={5}
            height={Math.abs(Math.sin(i * 0.7)) * 80 + 20}
            fill={i === 5 || i === 9 ? accent : stroke}
            fillOpacity={i === 5 || i === 9 ? 1 : 0.16}
          />
        ))}
        <g transform="translate(220 100)">
          <circle r="48" fill="none" stroke={stroke} strokeOpacity="0.15" />
          <circle r="30" fill="none" stroke={stroke} strokeOpacity="0.25" />
          <circle r="5" fill={accent} />
        </g>
        <text x="20" y="32" {...mono}>
          07 / SIFT
        </text>
      </svg>
    )
  }
  if (kind === 'atlas') {
    return (
      <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="200" fill="#0b0b0d" />
        {[...Array(48)].map((_, i) => {
          const x = (i * 37) % 320
          const y = ((i * 53) % 160) + 30
          const on = i % 7 === 0
          return (
            <circle key={i} cx={x} cy={y} r={on ? 3 : 1.4} fill={on ? accent : '#fff'} fillOpacity={on ? 1 : 0.45} />
          )
        })}
        <line x1="40" y1="60" x2="260" y2="140" stroke="rgba(255,255,255,0.18)" />
        <line x1="80" y1="160" x2="240" y2="50" stroke="rgba(255,255,255,0.14)" />
        <text x="20" y="32" {...mono} fill="rgba(255,255,255,0.55)">
          08 / ATLAS
        </text>
      </svg>
    )
  }

  // Fallback — real apps without a bespoke visual.
  const c = fallback?.color || accent
  return (
    <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="200" fill={bg} />
      <rect width="320" height="200" fill={c} fillOpacity="0.06" />
      <circle cx="160" cy="96" r="46" fill={c} fillOpacity="0.12" />
      <circle cx="160" cy="96" r="46" fill="none" stroke={c} strokeOpacity="0.5" />
      <text x="160" y="112" textAnchor="middle" style={{ fontSize: 40 }}>
        {fallback?.icon || '✦'}
      </text>
      <text x="20" y="32" {...mono} fill={c} fillOpacity="0.8">
        {(fallback?.label || 'app').toString().slice(0, 18).toUpperCase()}
      </text>
    </svg>
  )
}
