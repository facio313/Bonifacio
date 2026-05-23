import type { App } from './types/app'

export const apps: App[] = [
  {
    id: 'app1',
    title: '성지순례',
    description: 'pilgrimage',
    port: 3000,
    href: '/pilgrimage',
    tags: ['React', 'TypeScript'],
    color: '#6366f1',
    icon: '🗺️',
  },
]
