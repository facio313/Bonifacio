/* 00 — INTRO / HERO section. Full viewport. */
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Reveal, Arrow, LiveDot } from '../atoms'
import { SectionRail } from '../Nav'
import { CardVisual } from '../CardVisual'
import { apps } from '../../apps.config'
import { BLOG_HREF } from '../../blog.config'
import { ACCENT, BIO_LINE } from '../../site'

const scrollTo = (id: string) => (e: MouseEvent) => {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Works preview shown under the hero CTAs.
// `id` doubles as the CardVisual key, so Pilgrimage gets its bespoke route visual.
const previewList = apps.map((app, index) => ({
  id: app.id,
  num: String(index + 1).padStart(2, '0'),
  name: app.title,
}))

export const Profile = () => {
  // mouse-tracked subtle parallax
  const wrapRef = useRef<HTMLElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const onMove = (e: MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    const x = (e.clientX - r.left - r.width / 2) / r.width
    const y = (e.clientY - r.top - r.height / 2) / r.height
    setTilt({ x: x * 6, y: y * -4 })
  }
  const onLeave = () => setTilt({ x: 0, y: 0 })

  return (
    <section
      id="intro"
      className="section"
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-screen-label="00 Intro"
    >
      <SectionRail num="00" label="Intro" />

      {/* top utility row pinned to top of section */}
      <div
        className="intro-utility"
        style={{
          position: 'absolute',
          top: 32,
          left: 120,
          right: 120,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--ink)',
            textTransform: 'none',
            letterSpacing: '-0.02em',
          }}
        >
          최경수<span style={{ color: 'var(--accent)' }}>.</span>
        </span>
        <div className="intro-utility-actions">
          <span className="intro-availability">
            <LiveDot /> Available for work · 2026
          </span>
          <a className="monitor-link" href="/monitor/" aria-label="서버 모니터 열기">
            Monitor <Arrow size={10} rotate={-45} />
          </a>
          <a className="monitor-link" href="/sso/admin/" aria-label="SSO 사용자 관리 열기">
            SSO Admin <Arrow size={10} rotate={-45} />
          </a>
        </div>
      </div>

      <div
        className="intro-main"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          width: '100%',
          maxWidth: 1280,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Reveal delay={80}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ width: 32, height: 1, background: 'var(--ink)', display: 'inline-block' }} />
              Choi Kyungsoo · Web Developer
            </div>
          </Reveal>

          <Reveal delay={180}>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(44px, 6.4vw, 96px)',
                lineHeight: 1.02,
                letterSpacing: '-0.05em',
                fontWeight: 700,
                color: 'var(--ink)',
                transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0)`,
                transition: 'transform 0.5s cubic-bezier(0.2,0.7,0.2,1)',
                wordBreak: 'keep-all',
              }}
            >
              대용량 트래픽을 견디고<span style={{ color: 'var(--accent)' }}>,</span>
              <br />
              <span style={{ color: 'var(--accent)' }}>AI</span>가 흐르는 화면을 만듭니다
              <span style={{ color: 'var(--accent)' }}>.</span>
            </h1>
          </Reveal>

          <Reveal delay={300}>
            <p
              style={{
                margin: 0,
                maxWidth: 720,
                fontSize: 'clamp(16px, 1.4vw, 19px)',
                lineHeight: 1.6,
                color: 'var(--ink-2)',
                letterSpacing: '-0.012em',
                fontWeight: 500,
                wordBreak: 'keep-all',
                textWrap: 'pretty',
              }}
            >
              {BIO_LINE}
            </p>
          </Reveal>

          <Reveal delay={420}>
            <div
              className="intro-cta"
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
            >
              <a
                href="#works"
                onClick={scrollTo('works')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 22px',
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  borderRadius: 999,
                  textDecoration: 'none',
                  fontSize: 14.5,
                  letterSpacing: '-0.01em',
                  fontWeight: 500,
                  transition: 'background 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--ink)'
                }}
              >
                작업 보러가기 <Arrow />
              </a>
              <a
                href="#about"
                onClick={scrollTo('about')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 22px',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 999,
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  fontWeight: 500,
                  transition: 'border-color 0.3s, color 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line-strong)'
                  e.currentTarget.style.color = 'var(--ink)'
                }}
              >
                소개 읽기
              </a>
              <a
                href={BLOG_HREF}
                className="intro-blog-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 22px',
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  borderRadius: 999,
                  textDecoration: 'none',
                  color: 'var(--accent-ink)',
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  fontWeight: 500,
                  transition: 'transform 0.3s, box-shadow 0.3s, background 0.3s',
                }}
              >
                블로그 <Arrow rotate={-45} />
              </a>
            </div>
          </Reveal>
        </div>

        <div style={{ marginTop: 'clamp(32px, 6vh, 64px)' }}>
          <Reveal delay={540}>
            <MiniCardStrip accent={ACCENT} />
          </Reveal>
        </div>
      </div>

      {/* scroll indicator at bottom */}
      <div
        className="intro-scroll"
        style={{
          position: 'absolute',
          bottom: 32,
          left: 120,
          right: 120,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span>Seoul, KR · cks@bonifacio.work</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          Scroll
          <span style={{ display: 'inline-block', animation: 'float 2.4s ease-in-out infinite' }}>
            <Arrow rotate={90} />
          </span>
        </span>
      </div>
    </section>
  )
}

/* Mini card strip — small horizontal preview of work cards under the CTA */
const MiniCardStrip = ({ accent }: { accent: string }) => {
  const list = previewList

  return (
    <div className="mini-strip-wrap" style={{ marginTop: 28, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ width: 18, height: 1, background: 'var(--muted)' }} />
          {String(list.length).padStart(2, '0')} works · preview
        </div>
        <a
          href="#works"
          onClick={scrollTo('works')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          View all
          <Arrow size={10} rotate={-45} />
        </a>
      </div>

      <div
        className="mini-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))`,
          gap: 10,
        }}
      >
        {list.map((p, i) => (
          <a
            key={p.id}
            href="#works"
            onClick={scrollTo('works')}
            className="mini-card"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              textDecoration: 'none',
              color: 'inherit',
              aspectRatio: '4 / 5',
              boxShadow: 'var(--shadow-1)',
              animationDelay: `${i * 60}ms`,
              transition: 'transform 0.4s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.4s, border-color 0.3s',
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: '1 1 60%',
                overflow: 'hidden',
                borderBottom: '1px solid var(--line)',
                background: '#fff',
              }}
            >
              <div style={{ position: 'absolute', inset: 0 }}>
                <CardVisual kind={p.id} accent={accent} />
              </div>
            </div>
            <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--muted)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {p.num}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.name}
              </div>
            </div>
          </a>
        ))}
      </div>

      <style>{`
        .mini-card:hover {
          transform: translateY(-3px);
          border-color: var(--accent) !important;
          box-shadow: var(--shadow-2) !important;
        }
        @media (max-width: 1024px) {
          .mini-strip { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .mini-strip .mini-card:nth-child(n+5) { display: none !important; }
        }
        @media (max-width: 720px) {
          .mini-strip { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .mini-strip .mini-card:nth-child(n+4) { display: none !important; }
        }
      `}</style>
    </div>
  )
}
