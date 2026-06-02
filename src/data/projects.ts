/* Showcase (virtual) projects for the Works section.
   Real, openable apps live in src/apps.config.ts and are merged in by Works. */

export type ProjectStatus = 'live' | 'beta' | 'wip'
export type ProjectSpan = 'hero' | 'wide'

export interface Project {
  id: string
  num: string
  name: string
  tag: string
  desc: string
  stack: string[]
  status: ProjectStatus
  span?: ProjectSpan
  href?: string
}

export const projects: Project[] = [
  {
    id: 'orbit',
    num: '02',
    name: 'Orbit',
    tag: 'Scheduling',
    desc: '여러 타임존을 가진 팀이 공통 시간을 찾기 위한 일정 조율 도구.',
    stack: ['Next.js', 'tRPC', 'Postgres'],
    status: 'live',
    href: '#',
  },
  {
    id: 'inkwell',
    num: '03',
    name: 'Inkwell',
    tag: 'Writing',
    desc: '집중을 위한 미니멀 마크다운 에디터. 단축키 중심, 자동 백업.',
    stack: ['Svelte', 'Tauri'],
    status: 'live',
    href: '#',
  },
  {
    id: 'tide',
    num: '04',
    name: 'Tide',
    tag: 'Finance',
    desc: '프리랜서를 위한 영수증·세금 추적기. CSV로 들어오고 보고서로 나갑니다.',
    stack: ['Remix', 'SQLite'],
    status: 'beta',
    href: '#',
  },
  {
    id: 'glyph',
    num: '05',
    name: 'Glyph',
    tag: 'Typography',
    desc: '폰트 페어링을 즉시 비교하는 브라우저 도구. Google Fonts 4,000종 지원.',
    stack: ['Vanilla', 'Vite'],
    status: 'live',
    span: 'wide',
    href: '#',
  },
  {
    id: 'pocket',
    num: '06',
    name: 'Pocket',
    tag: 'Bookmarks',
    desc: '읽을거리를 모았다가, 일주일이 지나도 안 본 것은 조용히 지워줍니다.',
    stack: ['Hono', 'Cloudflare'],
    status: 'wip',
    href: '#',
  },
  {
    id: 'sift',
    num: '07',
    name: 'Sift',
    tag: 'AI · Code Review',
    desc: 'PR을 잘게 쪼개 읽고, 대형 레거시 코드베이스에서 위험 신호를 먼저 꼽아 보여주는 리뷰 보조.',
    stack: ['LLM', 'TypeScript'],
    status: 'beta',
    href: '#',
  },
  {
    id: 'atlas',
    num: '08',
    name: 'Atlas',
    tag: 'AI · Knowledge',
    desc: '사내 위키·문서를 RAG로 묶어 자연어로 질문하고 답을 끌어오는 지식 검색 엔진.',
    stack: ['Python', 'pgvector'],
    status: 'wip',
    href: '#',
  },
]
