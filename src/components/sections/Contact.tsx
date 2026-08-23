/* 04 — CONTACT section */
import { Reveal, Arrow } from '../atoms'
import { SectionRail } from '../Nav'

export const Contact = () => {
  const links = [
    { k: 'Email', v: 'cks@bonifacio.work', href: 'mailto:cks@bonifacio.work' },
    { k: 'GitHub', v: 'github.com/facio313', href: 'https://github.com/facio313' },
    { k: 'LinkedIn', v: 'in/choikyungsoo', href: '#' },
    { k: 'Resume', v: 'PDF · 2026', href: '#' },
  ]

  return (
    <section id="contact" className="section" data-screen-label="04 Contact" style={{ background: 'var(--ink)' }}>
      <SectionRail num="04" label="Contact" />
      <style>{`
        #contact .section-rail .num { color: var(--bg); }
        #contact .section-rail .vrt { color: rgba(255,255,255,0.5); }
        #contact .section-rail .tick { background: rgba(255,255,255,0.15); }
      `}</style>

      <Reveal>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <span style={{ width: 32, height: 1, background: 'var(--bg)', display: 'inline-block' }} />
          04 / Contact
        </div>
      </Reveal>

      <Reveal delay={120}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(44px, 6.4vw, 100px)',
            lineHeight: 0.98,
            letterSpacing: '-0.045em',
            fontWeight: 700,
            color: 'var(--bg)',
            wordBreak: 'keep-all',
            maxWidth: 1200,
          }}
        >
          함께 만들고 싶은 것이 있다면<span style={{ color: 'var(--accent)' }}>,</span>
          <br />
          편하게 연락 주세요<span style={{ color: 'var(--accent)' }}>.</span>
        </h2>
      </Reveal>

      <Reveal delay={300}>
        <div
          className="contact-grid"
          style={{
            marginTop: 48,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 56,
            alignItems: 'flex-end',
          }}
        >
          <a
            href="mailto:cks@bonifacio.work"
            className="cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              padding: '20px 28px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 999,
              textDecoration: 'none',
              fontSize: 18,
              letterSpacing: '-0.015em',
              fontWeight: 500,
              justifySelf: 'flex-start',
              transition: 'transform 0.3s, background 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            cks@bonifacio.work
            <Arrow rotate={-45} size={16} />
          </a>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {links.map((row) => (
              <li key={row.k}>
                <a
                  href={row.href}
                  className="dark-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '16px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.15)',
                    textDecoration: 'none',
                    color: 'var(--bg)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.5)',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ fontSize: 16, letterSpacing: '-0.01em' }}>{row.v}</span>
                  <span className="dark-arrow" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <Arrow rotate={-45} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={400}>
        <div
          className="contact-footer"
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <span>© 2026 Choi Kyungsoo</span>
          <span>Seoul, Republic of Korea</span>
          <span>Set in Pretendard</span>
        </div>
      </Reveal>

      <style>{`
        .dark-row { transition: padding 0.4s cubic-bezier(0.2,0.7,0.2,1), color 0.3s; }
        .dark-row:hover { padding-left: 14px !important; color: var(--accent) !important; }
        .dark-row:hover .dark-arrow { color: var(--accent); transform: translateX(4px); }
        .dark-arrow { transition: transform 0.4s cubic-bezier(0.2,0.7,0.2,1); display: inline-block; }
      `}</style>
    </section>
  )
}
