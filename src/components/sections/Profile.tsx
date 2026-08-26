/* 00 — INTRO / HERO section. Full viewport. */
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Reveal, Arrow, LiveDot } from '../atoms'
import { SectionRail } from '../Nav'
import { CardVisual } from '../CardVisual'
import { EditableLink, EditableText } from '../ContentEditor'
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
  icon: app.icon,
  color: app.color,
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
          <EditableText contentKey="profile.owner" label="이름" defaultValue="최경수" as="span" />
          <span style={{ color: 'var(--accent)' }}>.</span>
        </span>
        <div className="intro-utility-actions">
          <span className="intro-availability">
            <LiveDot />{' '}
            <EditableText
              contentKey="profile.status"
              label="업무 가능 상태"
              defaultValue="Available for work · 2026"
              as="span"
            />
          </span>
          <EditableLink className="monitor-link" href="/monitor/" aria-label="서버 모니터 열기">
            <EditableText
              contentKey="profile.utility.monitor"
              label="Monitor 버튼"
              defaultValue="Monitor"
            />{' '}
            <Arrow size={10} rotate={-45} />
          </EditableLink>
          <EditableLink className="monitor-link" href="/sso/user/" aria-label="내 정보 열기">
            <EditableText
              contentKey="profile.utility.account"
              label="내 정보 버튼"
              defaultValue="내 정보"
            />{' '}
            <Arrow size={10} rotate={-45} />
          </EditableLink>
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
              <EditableText
                contentKey="profile.role"
                label="이름과 역할"
                defaultValue="Choi Kyungsoo · Web Developer"
                as="span"
              />
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
              <EditableText
                contentKey="profile.hero.line1"
                label="메인 문구 첫째 줄"
                defaultValue="대용량 트래픽을 견디고"
                as="span"
                render={(value) => (
                  <>
                    {value}<span style={{ color: 'var(--accent)' }}>,</span>
                  </>
                )}
              />
              <br />
              <EditableText
                contentKey="profile.hero.line2"
                label="메인 문구 둘째 줄"
                defaultValue="AI가 흐르는 화면을 만듭니다"
                as="span"
                render={(value) => (
                  <>
                    {value.startsWith('AI') ? (
                      <><span style={{ color: 'var(--accent)' }}>AI</span>{value.slice(2)}</>
                    ) : value}
                    <span style={{ color: 'var(--accent)' }}>.</span>
                  </>
                )}
              />
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
              <EditableText
                contentKey="profile.bio"
                label="소개 문장"
                defaultValue={BIO_LINE}
                as="span"
                multiline
              />
            </p>
          </Reveal>

          <Reveal delay={420}>
            <div
              className="intro-cta"
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
            >
              <EditableLink
                href="#works"
                onClick={scrollTo('works')}
                className="intro-action"
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
                <EditableText
                  contentKey="profile.cta.works"
                  label="작업 보기 버튼"
                  defaultValue="작업 보러가기"
                  as="span"
                />{' '}
                <Arrow />
              </EditableLink>
              <EditableLink
                href="#about"
                onClick={scrollTo('about')}
                className="intro-action"
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
                <EditableText
                  contentKey="profile.cta.about"
                  label="소개 읽기 버튼"
                  defaultValue="소개 읽기"
                  as="span"
                />
              </EditableLink>
              <EditableLink
                href={BLOG_HREF}
                className="intro-action intro-blog-cta"
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
                <EditableText
                  contentKey="profile.cta.blog"
                  label="블로그 버튼"
                  defaultValue="블로그"
                  as="span"
                />{' '}
                <Arrow rotate={-45} />
              </EditableLink>
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
        <span>
          <EditableText contentKey="profile.location" label="위치" defaultValue="Seoul, KR" as="span" />
          {' · '}
          <EditableText
            contentKey="contact.email"
            label="이메일"
            defaultValue="cks@bonifacio.work"
            as="span"
          />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <EditableText contentKey="profile.scroll" label="스크롤 안내" defaultValue="Scroll" />
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
          {String(list.length).padStart(2, '0')}{' '}
          <EditableText
            contentKey="profile.preview.label"
            label="작업 미리보기 라벨"
            defaultValue="works · preview"
          />
        </div>
        <EditableLink
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
          <EditableText
            contentKey="profile.preview.viewAll"
            label="작업 전체 보기 링크"
            defaultValue="View all"
          />
          <Arrow size={10} rotate={-45} />
        </EditableLink>
      </div>

      <div
        className="mini-strip"
        role="region"
        aria-label="작업 미리보기 목록. 좌우로 스크롤하여 전체 작업을 볼 수 있습니다."
        tabIndex={0}
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: '192px',
          gridTemplateRows: '1fr',
          gap: 10,
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorInline: 'contain',
          scrollSnapType: 'x proximity',
          scrollbarWidth: 'thin',
          padding: '8px 2px 14px',
        }}
      >
        {list.map((p, i) => (
          <EditableLink
            key={p.id}
            href="#works"
            onClick={scrollTo('works')}
            className="mini-card"
            editingAs="div"
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
              scrollSnapAlign: 'start',
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
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
                <CardVisual
                  kind={p.id}
                  accent={p.color || accent}
                  fallback={{ icon: p.icon, label: p.name, color: p.color }}
                />
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
                {p.id === 'wgang' ? p.name : (
                  <EditableText
                    contentKey={`works.app.${p.id}.title`}
                    label={`${p.name} 작업 제목`}
                    defaultValue={p.name}
                    as="span"
                  />
                )}
              </div>
            </div>
          </EditableLink>
        ))}
      </div>

      <style>{`
        .mini-card:hover {
          transform: translateY(-3px);
          border-color: var(--accent) !important;
          box-shadow: var(--shadow-2) !important;
        }
        .mini-strip:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 3px;
        }
        @media (max-width: 720px) {
          .mini-strip { grid-auto-columns: 160px !important; }
        }
      `}</style>
    </div>
  )
}
