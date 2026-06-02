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
