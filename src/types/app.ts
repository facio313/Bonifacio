export type AppStatus = 'live' | 'beta' | 'wip'

export interface App {
  id: string
  title: string
  description: string
  tags: string[]
  color: string
  icon: string
  status: AppStatus
  /** Canonical production URL. Internal paths always include a trailing slash. */
  href: string
  external?: boolean
}
