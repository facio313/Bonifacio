import type { App } from './types/app'

export const apps: App[] = [
  {
    id: 'pilgrimage',
    title: 'Pilgrimage',
    description: '지도 위에서 현재 위치를 검색하고 GPS로 바로 이동하는 순례 길잡이 앱.',
    port: 3000,
    href: '/pilgrimage',
    tags: ['React', '지도', 'GPS'],
    color: '#0a84ff',
    icon: '🗺️',
  },
]
