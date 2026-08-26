/* 02 — WORKS section: showcase project cards + real, openable apps. */
import { useState } from 'react'
import { Reveal, Arrow, useReveal } from '../atoms'
import { SectionRail, BigNumber } from '../Nav'
import { CardVisual } from '../CardVisual'
import { apps } from '../../apps.config'
import type { App, AppStatus } from '../../types/app'
import { ACCENT } from '../../site'
import { EditableText, useContentEditMode, useEditableValue } from '../ContentEditor'

interface WorkCard {
  id: string
  num: string
  name: string
  tag: string
  desc: string
  stack: string[]
  status: AppStatus
  span?: 'hero' | 'wide'
  kind?: string // bespoke visual key
  href: string
  external?: boolean
  fallback?: { icon?: string; label?: string; color?: string }
}

const fromApp = (app: App, num: string): WorkCard => ({
  id: app.id,
  num,
  name: app.title,
  kind: app.id,
  tag: app.tags[0] ?? 'App',
  desc: app.description,
  stack: app.tags,
  status: app.status,
  href: app.href,
  external: app.external,
  fallback: { icon: app.icon, label: app.title, color: app.color },
})

// Pilgrimage is the real app that headlines the grid as the hero card.
const HERO_APP_ID = 'pilgrimage'

const buildCards = (): WorkCard[] => {
  const heroApp = apps.find((a) => a.id === HERO_APP_ID)
  const otherApps = apps.filter((a) => a.id !== HERO_APP_ID)

  const cards: WorkCard[] = []
  if (heroApp) cards.push({ ...fromApp(heroApp, '01'), span: 'hero', kind: 'pilgrimage' })
  otherApps.forEach((app, i) =>
    cards.push(fromApp(app, String(2 + i).padStart(2, '0'))),
  )
  return cards
}

const statusBadge = (s: AppStatus) => {
  if (s === 'live') return { label: 'Live', dot: 'var(--accent)', color: 'var(--ink)' }
  if (s === 'beta') return { label: 'Beta', dot: '#c9a227', color: 'var(--ink)' }
  return { label: 'In progress', dot: 'var(--muted)', color: 'var(--muted)' }
}

const tagContentKey = (cardId: string, tag: string) =>
  `works.app.${cardId}.tags.${encodeURIComponent(tag.toLowerCase())}`

const ProjectCard = ({ card, accent }: { card: WorkCard; accent: string }) => {
  const [hover, setHover] = useState(false)
  const ref = useReveal()
  const editMode = useContentEditMode()
  const s = statusBadge(card.status)
  const isHero = card.span === 'hero'
  const isWide = card.span === 'wide'
  const isEditable = card.id !== 'wgang'
  const titleKey = `works.app.${card.id}.title`
  const descriptionKey = `works.app.${card.id}.description`
  const editedTitle = useEditableValue(titleKey, card.name)
  const minH = isHero ? 640 : 400

  const cardStyle = {
    position: 'relative',
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-card)',
    textDecoration: 'none',
    color: 'inherit',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: isWide ? 'row' : 'column',
    minHeight: minH,
    boxShadow: hover ? 'var(--shadow-3)' : 'var(--shadow-1)',
    transform: hover ? 'translateY(-4px)' : 'translateY(0)',
    transition: 'transform 0.5s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.5s cubic-bezier(0.2,0.7,0.2,1)',
    willChange: 'transform',
    gridColumn: isHero ? 'span 2' : isWide ? 'span 2' : 'auto',
    gridRow: isHero ? 'span 2' : 'auto',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    padding: 0,
    width: '100%',
  } as const

  const className = `reveal card ${isHero ? 'card-hero' : ''} ${isWide ? 'card-wide' : ''}`

  const inner = (
    <>
      {/* visual */}
      <div
        className="card-visual"
        style={{
          position: 'relative',
          aspectRatio: isHero ? 'auto' : isWide ? '4 / 5' : '16 / 10',
          flex: isWide ? '0 0 44%' : isHero ? '1 1 auto' : 'none',
          minHeight: isHero ? 360 : 'auto',
          overflow: 'hidden',
          borderBottom: isWide ? 'none' : '1px solid var(--line)',
          borderRight: isWide ? '1px solid var(--line)' : 'none',
          background: '#fff',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            transform: hover ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 1.2s cubic-bezier(0.2,0.7,0.2,1)',
          }}
        >
          <CardVisual
            kind={card.kind}
            accent={card.fallback?.color || accent}
            fallback={card.fallback ? { ...card.fallback, label: isEditable ? editedTitle : card.fallback.label } : undefined}
          />
        </div>
        {/* accent sweep on hover */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(120deg, transparent 40%, ${accent}22 50%, transparent 60%)`,
            backgroundSize: '200% 100%',
            opacity: hover ? 1 : 0,
            animation: hover ? 'shimmer 1.6s linear infinite' : 'none',
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
          }}
        />
        {isHero && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--accent)',
              background: '#fff',
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            <EditableText contentKey="works.featured" label="대표 작업 배지" defaultValue="Featured" />
          </div>
        )}
      </div>

      {/* body */}
      <div
        style={{
          padding: isHero ? '32px 36px 36px' : '24px 26px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          <span>
            {card.num} ·{' '}
            {isEditable ? (
              <EditableText
                contentKey={tagContentKey(card.id, card.tag)}
                label={`${card.name} 대표 기술`}
                defaultValue={card.tag}
              />
            ) : (
              card.tag
            )}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: s.color }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: s.dot,
                animation: card.status === 'live' ? 'pulseDot 2s ease-out infinite' : 'none',
              }}
            />
            {isEditable ? (
              <EditableText
                contentKey={`works.app.${card.id}.statusLabel`}
                label={`${card.name} 상태 문구`}
                defaultValue={s.label}
              />
            ) : (
              s.label
            )}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: isHero ? 52 : 28,
              letterSpacing: '-0.035em',
              fontWeight: 600,
              color: 'var(--ink)',
              lineHeight: 1,
            }}
          >
            {isEditable ? (
              <EditableText contentKey={titleKey} label={`${card.name} 프로젝트명`} defaultValue={card.name} />
            ) : (
              card.name
            )}
          </h3>
        </div>

        <p
          style={{
            margin: isHero ? '8px 0 0' : '0',
            fontSize: isHero ? 17 : 14.5,
            lineHeight: 1.55,
            color: 'var(--ink-2)',
            maxWidth: isHero ? 560 : 440,
            textWrap: 'pretty',
            wordBreak: 'keep-all',
          }}
        >
          {isEditable ? (
            <EditableText
              contentKey={descriptionKey}
              label={`${card.name} 프로젝트 설명`}
              defaultValue={card.desc}
              multiline
            />
          ) : (
            card.desc
          )}
        </p>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 14,
            borderTop: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {card.stack.map((t, index) => (
              <span
                key={`${t}-${index}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  padding: '4px 8px',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {isEditable ? (
                  <EditableText
                    contentKey={tagContentKey(card.id, t)}
                    label={`${card.name} 기술 ${index + 1}`}
                    defaultValue={t}
                  />
                ) : (
                  t
                )}
              </span>
            ))}
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: hover ? 'var(--accent)' : 'var(--ink)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'color 0.3s',
            }}
          >
            {isEditable ? (
              <EditableText
                contentKey={`works.app.${card.id}.actionLabel`}
                label={`${card.name} 열기 문구`}
                defaultValue={card.status === 'wip' ? 'Coming soon' : 'Open'}
              />
            ) : card.status === 'wip' ? (
              'Coming soon'
            ) : (
              'Open'
            )}
            <span
              style={{
                display: 'inline-block',
                transform: hover ? 'translate(4px,-4px)' : 'translate(0,0)',
                transition: 'transform 0.4s cubic-bezier(0.2,0.7,0.2,1)',
              }}
            >
              <Arrow rotate={-45} />
            </span>
          </span>
        </div>
      </div>
    </>
  )

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  }

  if (editMode) {
    return (
      <article
        ref={ref as React.Ref<HTMLElement>}
        className={className}
        style={{ ...cardStyle, cursor: 'default' }}
        {...handlers}
      >
        {inner}
      </article>
    )
  }

  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={card.href}
      target={card.external ? '_blank' : undefined}
      rel={card.external ? 'noopener noreferrer' : undefined}
      className={className}
      style={cardStyle}
      {...handlers}
    >
      {inner}
    </a>
  )
}

export const Works = () => {
  const accent = ACCENT
  const cards = buildCards()

  return (
    <section id="works" className="section section-tall" data-screen-label="02 Works">
      <SectionRail num="02" label="Works" />

      <BigNumber
        n="02"
        kicker={
          <EditableText
            contentKey="works.kicker"
            label="Works 상단 문구"
            defaultValue="Selected works · 2021—2026"
          />
        }
        label={
          <>
            <EditableText
              contentKey="works.heading"
              label="Works 제목"
              defaultValue="만들어 온 작은 도구들"
            />
            <span style={{ color: 'var(--accent)' }}>.</span>
          </>
        }
      />

      {/* Section sub-header with count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingBottom: 32,
          gap: 32,
          flexWrap: 'wrap',
        }}
      >
        <Reveal>
          <p
            style={{
              margin: 0,
              maxWidth: 580,
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--ink-2)',
              letterSpacing: '-0.01em',
              wordBreak: 'keep-all',
              textWrap: 'pretty',
            }}
          >
            <EditableText
              contentKey="works.introduction"
              label="Works 소개"
              defaultValue="업무 외 시간에 천천히 만들어 온 웹앱들. 하나의 문제를 정확히 푸는, 가볍게 열리고 빠르게 닫히는 도구를 지향합니다."
              multiline
            />
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              textAlign: 'right',
              lineHeight: 1.8,
            }}
          >
            {String(cards.length).padStart(2, '0')}{' '}
            <EditableText contentKey="works.countLabel" label="작업 개수 단위" defaultValue="works" />
            <br />
            <span style={{ color: 'var(--ink)' }}>
              <EditableText contentKey="works.period" label="Works 기간" defaultValue="2021 — 2026" />
            </span>
          </div>
        </Reveal>
      </div>

      {/* Grid */}
      <div
        className="cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridAutoFlow: 'dense',
          gridAutoRows: 'minmax(320px, auto)',
          gap: 20,
        }}
      >
        {cards.map((card) => (
          <ProjectCard key={card.id} card={card} accent={accent} />
        ))}
      </div>
    </section>
  )
}
