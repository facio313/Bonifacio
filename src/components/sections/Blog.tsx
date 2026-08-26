/* 03 — BLOG section: editorial preview for the separately deployed Blog app. */
import { BLOG_HREF, BLOG_POST_PREVIEWS } from '../../blog.config'
import type { BlogPostPreview } from '../../blog.config'
import { Arrow, Reveal } from '../atoms'
import { EditableLink, EditableText, useContentEditMode, useEditableValue } from '../ContentEditor'
import { BigNumber, SectionRail } from '../Nav'

const BlogIndexMark = () => {
  const editMode = useContentEditMode()
  return (
    <div className="blog-index-mark" aria-hidden={!editMode}>
      <EditableText
        contentKey="blog.decoration.motto"
        label="블로그 장식 문구"
        defaultValue="Read · Think · Build"
        as="span"
      />
      <strong>
        <EditableText
          contentKey="blog.decoration.initial"
          label="블로그 장식 이니셜"
          defaultValue="B"
          as="span"
        />
        <span>.</span>
      </strong>
      <EditableText
        contentKey="blog.decoration.index"
        label="블로그 장식 인덱스"
        defaultValue="03 / Journal"
        as="i"
      />
    </div>
  )
}

const BlogPostRow = ({ post, index }: { post: BlogPostPreview; index: number }) => {
  const indexLabel = String(index + 1).padStart(2, '0')
  const publishLabel = post.publishedAt ?? `Preview ${indexLabel}`
  const editedTitle = useEditableValue(`blog.posts.${post.slug}.title`, post.title)

  return (
    <Reveal delay={index * 90} className="blog-post-reveal">
      <EditableLink
        href={BLOG_HREF}
        editingAs="div"
        className="blog-post-row"
        aria-label={`${editedTitle} — 블로그로 이동`}
      >
        <span className="blog-post-index">{indexLabel}</span>
        <span className="blog-post-body">
          <span className="blog-post-meta">
            <EditableText
              contentKey={`blog.posts.${post.slug}.category`}
              label={`${post.title} 카테고리`}
              defaultValue={post.category}
              as="span"
            />
            <span aria-hidden="true">·</span>
            <EditableText
              contentKey={`blog.posts.${post.slug}.publishedAt`}
              label={`${post.title} 발행일`}
              defaultValue={publishLabel}
              as="span"
            />
            <span aria-hidden="true">·</span>
            <EditableText
              contentKey={`blog.posts.${post.slug}.readTime`}
              label={`${post.title} 읽기 시간`}
              defaultValue={post.readTime}
              as="span"
            />
          </span>
          <EditableText
            contentKey={`blog.posts.${post.slug}.title`}
            label={`${post.title} 제목`}
            defaultValue={post.title}
            as="strong"
          />
          <EditableText
            contentKey={`blog.posts.${post.slug}.excerpt`}
            label={`${post.title} 요약`}
            defaultValue={post.excerpt}
            as="span"
            multiline
            className="blog-post-excerpt"
          />
        </span>
        <span className="blog-post-arrow" aria-hidden="true">
          <Arrow rotate={-45} size={16} />
        </span>
      </EditableLink>
    </Reveal>
  )
}

export const Blog = () => (
  <section
    id="blog"
    className="section blog-section"
    data-screen-label="03 Blog"
    style={{ background: 'var(--blog-bg)' }}
  >
    <SectionRail num="03" label="Blog" />

    <BigNumber
      n="03"
      kicker={
        <EditableText
          contentKey="blog.kicker"
          label="Blog 상단 라벨"
          defaultValue="Latest notes · Journal"
          as="span"
        />
      }
      label={
        <>
          <EditableText
            contentKey="blog.heading"
            label="Blog 제목"
            defaultValue="만들며 알게 된 것들"
            as="span"
          />
          <span style={{ color: 'var(--accent)' }}>.</span>
        </>
      }
    />

    <div className="blog-layout">
      <Reveal className="blog-copy">
        <div className="blog-status">
          <span aria-hidden="true" />
          <EditableText
            contentKey="blog.status"
            label="블로그 상태 문구"
            defaultValue="Blog app · now open"
            as="span"
          />
        </div>
        <EditableText
          contentKey="blog.intro"
          label="블로그 소개 문단"
          defaultValue="개발과 AI, 오래 운영되는 시스템 사이에서 건진 생각을 짧게 기록합니다. 공개된 글은 블로그에서 바로 확인할 수 있습니다."
          as="p"
          multiline
        />
        <BlogIndexMark />
      </Reveal>

      <div className="blog-list" aria-label="블로그 글 미리보기">
        {BLOG_POST_PREVIEWS.map((post, index) => (
          <BlogPostRow key={post.slug} post={post} index={index} />
        ))}
      </div>

      <Reveal delay={280} className="blog-action">
        <EditableLink href={BLOG_HREF} className="blog-all-link">
          <EditableText
            contentKey="blog.action"
            label="블로그 전체 보기 링크"
            defaultValue="블로그에서 모두 보기"
            as="span"
          />
          <Arrow rotate={-45} size={16} />
        </EditableLink>
      </Reveal>
    </div>
  </section>
)
