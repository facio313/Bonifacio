/* Side rail label + dot navigation + section opener */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export const SectionRail = ({ num, label }: { num: string; label: string }) => (
  <div className="section-rail" aria-hidden="true">
    <div className="num">
      {num}
      <span>.</span>
    </div>
    <div className="tick" />
    <div className="vrt">{label}</div>
  </div>
)

const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'about', label: 'About' },
  { id: 'works', label: 'Works' },
  { id: 'blog', label: 'Blog' },
  { id: 'contact', label: 'Contact' },
]

export const DotNav = () => {
  const [active, setActive] = useState('intro')

  useEffect(() => {
    const handler = () => {
      const mid = window.innerHeight / 2
      let current = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom > mid) {
          current = s.id
          break
        }
      }
      setActive(current)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  return (
    <nav className={`dot-nav ${active === 'contact' ? 'on-dark' : ''}`} aria-label="Section navigation">
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          data-label={s.label}
          className={active === s.id ? 'active' : ''}
          aria-current={active === s.id ? 'true' : undefined}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      ))}
    </nav>
  )
}

// Big number block used as section opener
export const BigNumber = ({
  n,
  label,
  kicker,
}: {
  n: string
  label: ReactNode
  kicker: ReactNode
}) => (
  <div
    className="big-number"
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 24,
      marginBottom: 32,
      flexWrap: 'wrap',
    }}
  >
    <div
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(88px, 12vw, 156px)',
        lineHeight: 0.82,
        fontWeight: 600,
        letterSpacing: '-0.06em',
        color: 'var(--ink)',
      }}
    >
      {n}
      <span style={{ color: 'var(--accent)' }}>.</span>
    </div>
    <div
      style={{
        paddingBottom: 'clamp(14px, 1.6vw, 22px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 2.4vw, 32px)',
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1.05,
          color: 'var(--ink)',
          wordBreak: 'keep-all',
        }}
      >
        {label}
      </div>
    </div>
  </div>
)
