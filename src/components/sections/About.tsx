/* 01 — ABOUT section: bio + career timeline + skills */
import { Reveal } from '../atoms'
import { EditableText } from '../ContentEditor'
import { SectionRail, BigNumber } from '../Nav'

const careerData = [
  {
    id: 'senior-web-developer',
    year: '2023 — Now',
    role: 'Senior Web Developer',
    company: '차세대 금융 시스템 개발',
    desc: '은행 코어 시스템 차세대 프로젝트. 대용량 트랜잭션 처리 모듈 설계와 마이크로서비스 전환을 담당.',
  },
  {
    id: 'web-developer',
    year: '2020 — 2023',
    role: 'Web Developer',
    company: '대용량 데이터 플랫폼',
    desc: '하루 수억 건 이벤트를 처리하는 데이터 파이프라인과 백오피스 운영 도구 개발·유지보수.',
  },
  {
    id: 'junior-developer',
    year: '2018 — 2020',
    role: 'Junior Developer',
    company: 'SI · 고도화 프로젝트',
    desc: '레거시 시스템 분석과 점진적 리팩토링, 신규 기능 고도화. 안정성과 호환성을 우선한 작업.',
  },
]

const skills = [
  { id: 'languages', group: 'Languages', items: ['Java', 'TypeScript', 'Python', 'SQL'] },
  { id: 'frameworks', group: 'Frameworks', items: ['Spring Boot', 'React', 'Next.js', 'Node.js'] },
  { id: 'data', group: 'Data', items: ['Kafka', 'Redis', 'PostgreSQL', 'ClickHouse'] },
  { id: 'interests', group: 'Interests', items: ['LLM / RAG', 'Agent UX', 'Observability', 'Design systems'] },
]

const contentId = (value: string) => encodeURIComponent(value.toLowerCase())

export const About = () => {
  return (
    <section id="about" className="section" data-screen-label="01 About" style={{ background: 'var(--bg-2)' }}>
      <SectionRail num="01" label="About" />

      <BigNumber
        n="01"
        kicker={
          <EditableText
            contentKey="about.kicker"
            label="About 상단 라벨"
            defaultValue="About me"
            as="span"
          />
        }
        label={
          <>
            <EditableText
              contentKey="about.heading"
              label="About 제목"
              defaultValue="지금까지의 궤적"
              as="span"
            />
            <span style={{ color: 'var(--accent)' }}>.</span>
          </>
        }
      />

      <div
        className="about-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'flex-start' }}
      >
        {/* LEFT — Bio statement */}
        <Reveal>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              <EditableText
                contentKey="about.statement.label"
                label="소개문 라벨"
                defaultValue="Statement"
                as="span"
              />
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(19px, 1.7vw, 24px)',
                lineHeight: 1.45,
                letterSpacing: '-0.02em',
                fontWeight: 500,
                color: 'var(--ink)',
                wordBreak: 'keep-all',
                textWrap: 'pretty',
              }}
            >
              <EditableText
                contentKey="about.statement.primary"
                label="소개문 첫 문단"
                defaultValue="은행·커머스 도메인에서 차세대 시스템 구축과 대용량 트래픽 처리, 오랜 기간 운영되는 서비스의 유지보수·고도화를 함께 해왔습니다."
                as="span"
                multiline
                render={(value) => {
                  const emphasis = '대용량 트래픽 처리'
                  const emphasisIndex = value.indexOf(emphasis)
                  if (emphasisIndex < 0) return value
                  return (
                    <>
                      {value.slice(0, emphasisIndex)}
                      <span style={{ color: 'var(--accent)' }}>{emphasis}</span>
                      {value.slice(emphasisIndex + emphasis.length)}
                    </>
                  )
                }}
              />
            </p>
            <EditableText
              contentKey="about.statement.secondary"
              label="소개문 두 번째 문단"
              defaultValue="최근에는 AI를 제품에 자연스럽게 들이는 작업 — 에이전트 UX, RAG, 코드베이스 위에서 동작하는 도구들 — 에 관심을 두고 있습니다."
              as="p"
              multiline
              style={{
                marginTop: 18,
                marginBottom: 0,
                fontSize: 14.5,
                lineHeight: 1.65,
                color: 'var(--ink-2)',
                maxWidth: 520,
                wordBreak: 'keep-all',
                textWrap: 'pretty',
              }}
            />
          </div>
        </Reveal>

        {/* RIGHT — Career timeline */}
        <Reveal delay={120}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              <EditableText
                contentKey="about.career.label"
                label="경력 타임라인 라벨"
                defaultValue="Career · 2018 — Now"
                as="span"
              />
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid var(--line)' }}>
              {careerData.map((row, i) => (
                <li
                  key={row.id}
                  className="career-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    gap: 20,
                    padding: '14px 0',
                    borderBottom: '1px solid var(--line)',
                    position: 'relative',
                    transition: 'padding-left 0.4s cubic-bezier(0.2,0.7,0.2,1)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--muted)',
                      letterSpacing: '0.1em',
                      paddingTop: 2,
                    }}
                  >
                    <EditableText
                      contentKey={`about.career.${row.id}.year`}
                      label={`경력 ${i + 1} 기간`}
                      defaultValue={row.year}
                      as="span"
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: '-0.015em',
                        color: 'var(--ink)',
                        marginBottom: 2,
                      }}
                    >
                      <EditableText
                        contentKey={`about.career.${row.id}.role`}
                        label={`경력 ${i + 1} 직무`}
                        defaultValue={row.role}
                        as="span"
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--accent)',
                        marginBottom: 6,
                        letterSpacing: '-0.01em',
                        fontWeight: 500,
                      }}
                    >
                      <EditableText
                        contentKey={`about.career.${row.id}.company`}
                        label={`경력 ${i + 1} 프로젝트`}
                        defaultValue={row.company}
                        as="span"
                      />
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: 'var(--ink-2)',
                        wordBreak: 'keep-all',
                        textWrap: 'pretty',
                      }}
                    >
                      <EditableText
                        contentKey={`about.career.${row.id}.description`}
                        label={`경력 ${i + 1} 설명`}
                        defaultValue={row.desc}
                        as="span"
                        multiline
                      />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* Skills strip */}
      <Reveal delay={220}>
        <div
          className="skills-grid"
          style={{
            marginTop: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            borderTop: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {skills.map((g, i) => (
            <div key={g.group} style={{ padding: '16px 20px', borderLeft: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--muted)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                <EditableText
                contentKey={`about.skills.${g.id}.group`}
                  label={`기술 그룹 ${i + 1} 이름`}
                  defaultValue={g.group}
                  as="span"
                />
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.items.map((s, itemIndex) => (
                  <li key={s} style={{ fontSize: 13.5, color: 'var(--ink)', letterSpacing: '-0.01em', fontWeight: 500 }}>
                    <EditableText
                      contentKey={`about.skills.${g.id}.items.${contentId(s)}`}
                      label={`기술 그룹 ${i + 1} 항목 ${itemIndex + 1}`}
                      defaultValue={s}
                      as="span"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>

      <style>{`
        .career-row:hover { padding-left: 12px !important; }
        .career-row:hover::before {
          content: ''; position: absolute; left: -12px; top: 26px;
          width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
        }
      `}</style>
    </section>
  )
}
