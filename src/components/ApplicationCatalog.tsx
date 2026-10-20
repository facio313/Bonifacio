import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { App } from '../types/app'

interface Entry { id: string; title: string; href: string; description: string }
interface Catalog { entries: Entry[]; revision: string; canManage: boolean }
const endpoint = '/sso/user/api/applications'

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || '앱 목록을 불러오지 못했습니다.')
  return data
}

export function useApplicationCatalog(defaultApps: App[]) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    jsonRequest(endpoint, { signal: controller.signal }).then((value) => {
      setCatalog(value)
      if (value.redirect && ['/', '/index.html'].includes(window.location.pathname)) window.location.replace(value.redirect)
    }).catch((error) => {
      if (!controller.signal.aborted) setError(error.message)
    })
    return () => controller.abort()
  }, [])
  const entries = catalog?.entries ?? []
  const dynamicApps: App[] = entries.map((entry) => ({
    ...entry, status: 'live', tags: ['App'], color: '#168fa6', icon: '↗', external: !entry.href.startsWith('/'),
  }))
  const applications = defaultApps.map((app) => {
    const entry = entries.find(({ id }) => id === app.id)
    return entry ? { ...app, ...entry } : app
  }).concat(dynamicApps.filter(({ id }) => !defaultApps.some((app) => app.id === id)))
  return { applications, catalog, setCatalog, error }
}

export function AddApplication({ catalog, onSave }: { catalog: Catalog; onSave: (value: Catalog) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  if (!catalog.canManage) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true)
    setError('')
    try {
      const session = await jsonRequest('/sso/user/api/session')
      const result = await jsonRequest(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken, 'If-Match': catalog.revision },
        body: JSON.stringify(Object.fromEntries(['id', 'title', 'href', 'description'].map((key) => [key, values.get(key)]))),
      })
      onSave(result)
      form.reset()
      dialog.current?.close()
      setSaved('앱을 등록했습니다. 내부 앱 권한은 SSO 계정 관리에서 설정할 수 있습니다.')
    } catch (error) { setError(error instanceof Error ? error.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }

  return <div className="application-catalog">
    <button type="button" className="application-add" onClick={() => { setError(''); dialog.current?.showModal() }} aria-label="앱 추가">＋ <span>앱 추가</span></button>
    {saved && <p role="status">{saved}</p>}
    <dialog ref={dialog} className="application-dialog" onCancel={(event) => { if (busy) event.preventDefault() }}>
      <form onSubmit={submit}>
        <h2>앱 추가</h2>
        <label>앱 이름<input name="title" autoFocus required maxLength={80} placeholder="Pongdang" /></label>
        <label>식별자<input name="id" required maxLength={48} pattern="[a-z][a-z0-9\-]*" placeholder="my-app" /></label>
        <label>URL<input name="href" required maxLength={2048} placeholder="/my-app/ 또는 https://example.com/" /></label>
        <p>내부 앱은 /앱/ 주소로 등록하면 SSO 접근권한 목록에도 추가됩니다. 외부 HTTPS 주소는 링크로 등록됩니다.</p>
        <label>설명<textarea name="description" maxLength={500} rows={3} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="application-dialog-actions">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>취소</button>
          <button type="submit" disabled={busy}>{busy ? '저장 중…' : '추가'}</button>
        </div>
      </form>
    </dialog>
  </div>
}
