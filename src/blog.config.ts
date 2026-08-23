/**
 * Canonical entry point for the separately deployed Blog app.
 *
 * The rows below are presentation-ready placeholders. Once the Blog exposes a
 * public, published-posts API, replace this array at the data boundary instead
 * of connecting the browser bundle directly to the shared database.
 */
export const BLOG_HREF = '/blog/' as const

export interface BlogPostPreview {
  slug: string
  title: string
  excerpt: string
  category: string
  publishedAt: string | null
  readTime: string
}

export const BLOG_POST_PREVIEWS: BlogPostPreview[] = [
  {
    slug: 'ai-as-a-flow',
    category: 'AI · Product',
    title: 'AI가 기능이 아니라 흐름이 되려면',
    excerpt: '에이전트 UX를 제품 안에 자연스럽게 들이기 위해 고민한 지점들.',
    publishedAt: null,
    readTime: '6 min read',
  },
  {
    slug: 'small-rules-for-lasting-systems',
    category: 'Engineering',
    title: '오래 가는 시스템의 작은 규칙',
    excerpt: '운영과 고도화 사이에서 반복해서 확인한 설계 원칙을 기록합니다.',
    publishedAt: null,
    readTime: '5 min read',
  },
  {
    slug: 'finishing-small-tools',
    category: 'Build log',
    title: '작은 도구를 끝까지 만드는 법',
    excerpt: '아이디어를 빠르게 열고, 실제로 닫히는 제품으로 다듬는 과정.',
    publishedAt: null,
    readTime: '4 min read',
  },
]
