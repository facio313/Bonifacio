/* 04 — CONTACT section */
import { Reveal, Arrow } from '../atoms'
import { SectionRail } from '../Nav'
import { EditableLink, EditableText, useEditableValue } from '../ContentEditor'

const externalHref = (value: string, fallbackHost?: string) => {
  const trimmed = value.trim()
  if (!trimmed) return '#'
  if (trimmed === '#') return '#'
  if (trimmed.startsWith('/')) return trimmed

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.includes('.')
      ? `https://${trimmed.replace(/^\/+/, '')}`
      : fallbackHost
        ? `https://${fallbackHost}/${trimmed.replace(/^[@/]+/, '')}`
        : ''

  if (!candidate) return '#'
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '#'
  } catch {
    return '#'
  }
}

export const Contact = () => {
  const email = useEditableValue('contact.email', 'cks@bonifacio.work')
  const githubHref = useEditableValue('contact.links.github.href', 'https://github.com/facio313')
  const linkedInHref = useEditableValue('contact.links.linkedin.href', '#')
  const resumeHref = useEditableValue('contact.links.resume.href', '#')
  const emailHref = `mailto:${email.trim().replace(/^mailto:/i, '')}`

  const links = [
    {
      id: 'email',
      labelKey: 'contact.links.email.label',
      defaultLabel: 'Email',
      valueKey: 'contact.email',
      defaultValue: 'cks@bonifacio.work',
      href: emailHref,
      hrefKey: null,
      defaultHref: null,
      fallbackHost: null,
    },
    {
      id: 'github',
      labelKey: 'contact.links.github.label',
      defaultLabel: 'GitHub',
      valueKey: 'contact.links.github.value',
      defaultValue: 'github.com/facio313',
      href: externalHref(githubHref, 'github.com'),
      hrefKey: 'contact.links.github.href',
      defaultHref: 'https://github.com/facio313',
      fallbackHost: 'github.com',
    },
    {
      id: 'linkedin',
      labelKey: 'contact.links.linkedin.label',
      defaultLabel: 'LinkedIn',
      valueKey: 'contact.links.linkedin.value',
      defaultValue: 'in/choikyungsoo',
      href: externalHref(linkedInHref, 'www.linkedin.com/in'),
      hrefKey: 'contact.links.linkedin.href',
      defaultHref: '#',
      fallbackHost: 'www.linkedin.com/in',
    },
    {
      id: 'resume',
      labelKey: 'contact.links.resume.label',
      defaultLabel: 'Resume',
      valueKey: 'contact.links.resume.value',
      defaultValue: 'PDF · 2026',
      href: externalHref(resumeHref),
      hrefKey: 'contact.links.resume.href',
      defaultHref: '#',
      fallbackHost: null,
    },
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
          <EditableText
            contentKey="contact.kicker"
            label="연락처 섹션 표제"
            defaultValue="04 / Contact"
            as="span"
          />
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
          <EditableText
            contentKey="contact.headline.line1"
            label="연락처 제목 첫째 줄"
            defaultValue="함께 만들고 싶은 것이 있다면"
            as="span"
            render={(value) => (
              <>
                {value}<span style={{ color: 'var(--accent)' }}>,</span>
              </>
            )}
          />
          <br />
          <EditableText
            contentKey="contact.headline.line2"
            label="연락처 제목 둘째 줄"
            defaultValue="편하게 연락 주세요"
            as="span"
            render={(value) => (
              <>
                {value}<span style={{ color: 'var(--accent)' }}>.</span>
              </>
            )}
          />
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
          <EditableLink
            href={emailHref}
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
            <EditableText
              contentKey="contact.email"
              label="이메일"
              defaultValue="cks@bonifacio.work"
              as="span"
            />
            <Arrow rotate={-45} size={16} />
          </EditableLink>

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
              <li key={row.id}>
                <EditableLink
                  href={row.href}
                  className="dark-row"
                  editingAs="div"
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
                    <EditableText
                      contentKey={row.labelKey}
                      label={`${row.defaultLabel} 링크 이름`}
                      defaultValue={row.defaultLabel}
                      as="span"
                    />
                  </span>
                  <span style={{ fontSize: 16, letterSpacing: '-0.01em' }}>
                    <EditableText
                      contentKey={row.valueKey}
                      label={`${row.defaultLabel} 링크 표시값`}
                      defaultValue={row.defaultValue}
                      as="span"
                    />
                  </span>
                  <span className="dark-arrow" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {row.hrefKey && row.defaultHref !== null ? (
                      <EditableText
                        contentKey={row.hrefKey}
                        label={`${row.defaultLabel} 링크 주소`}
                        defaultValue={row.defaultHref}
                        render={() => <Arrow rotate={-45} />}
                        validate={(value) => {
                          const trimmed = value.trim()
                          if (!trimmed) return '링크 주소를 입력하거나 비활성 상태를 뜻하는 #을 입력해 주세요.'
                          if (trimmed === '#') return null
                          if (/\s/.test(trimmed) || externalHref(trimmed, row.fallbackHost ?? undefined) === '#') {
                            return 'https:// 주소, /로 시작하는 경로, 또는 올바른 프로필 주소를 입력해 주세요.'
                          }
                          return null
                        }}
                      />
                    ) : (
                      <Arrow rotate={-45} />
                    )}
                  </span>
                </EditableLink>
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
          <EditableText
            contentKey="contact.footer.copyright"
            label="저작권 문구"
            defaultValue="© 2026 Choi Kyungsoo"
            as="span"
          />
          <EditableText
            contentKey="contact.footer.location"
            label="푸터 위치"
            defaultValue="Seoul, Republic of Korea"
            as="span"
          />
          <EditableText
            contentKey="contact.footer.typeface"
            label="서체 문구"
            defaultValue="Set in Pretendard"
            as="span"
          />
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
