/* 03 — BLOG section: editorial preview for the separately deployed Blog app. */
import { BLOG_HREF, BLOG_POST_PREVIEWS } from '../../blog.config'
import { Arrow, Reveal } from '../atoms'
import { BigNumber, SectionRail } from '../Nav'

export const Blog = () => (
  <section
    id="blog"
    className="section section-tall blog-section"
    data-screen-label="03 Blog"
    style={{ background: 'var(--blog-bg)' }}
  >
    <SectionRail num="03" label="Blog" />

    <BigNumber
      n="03"
      kicker="Latest notes · Journal"
      label={
        <>
          만들며 알게 된 것들<span style={{ color: 'var(--accent)' }}>.</span>
        </>
      }
    />

    <div className="blog-layout">
      <Reveal className="blog-copy">
        <div className="blog-status">
          <span aria-hidden="true" />
          Blog app · opening soon
        </div>
        <p>
          개발과 AI, 오래 운영되는 시스템 사이에서 건진 생각을 짧게 기록합니다. 블로그가 열리면 가장 최근 글
          세 편이 이곳에 놓입니다.
        </p>
        <div className="blog-index-mark" aria-hidden="true">
          <span>Read · Think · Build</span>
          <strong>
            B<span>.</span>
          </strong>
          <i>03 / Journal</i>
        </div>
      </Reveal>

      <div className="blog-list" aria-label="블로그 글 미리보기">
        {BLOG_POST_PREVIEWS.map((post, index) => {
          const indexLabel = String(index + 1).padStart(2, '0')
          const publishLabel = post.publishedAt ?? `Preview ${indexLabel}`

          return (
            <Reveal key={post.slug} delay={index * 90} className="blog-post-reveal">
              <a
                href={BLOG_HREF}
                className="blog-post-row"
                aria-label={`${post.title} — 블로그로 이동`}
              >
                <span className="blog-post-index">{indexLabel}</span>
                <span className="blog-post-body">
                  <span className="blog-post-meta">
                    <span>{post.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{publishLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.readTime}</span>
                  </span>
                  <strong>{post.title}</strong>
                  <span className="blog-post-excerpt">{post.excerpt}</span>
                </span>
                <span className="blog-post-arrow" aria-hidden="true">
                  <Arrow rotate={-45} size={16} />
                </span>
              </a>
            </Reveal>
          )
        })}
      </div>

      <Reveal delay={280} className="blog-action">
        <a href={BLOG_HREF} className="blog-all-link">
          블로그에서 모두 보기
          <Arrow rotate={-45} size={16} />
        </a>
      </Reveal>
    </div>
  </section>
)
