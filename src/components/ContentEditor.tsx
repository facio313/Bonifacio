import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  AnchorHTMLAttributes,
  CSSProperties,
  ElementType,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'

const CONTENT_STORAGE_KEY = 'bonifacio.content.v1'

type ContentOverrides = Record<string, string>

interface ActiveField {
  contentKey: string
  label: string
  defaultValue: string
  value: string
  multiline: boolean
  validate?: (value: string) => string | null
  returnFocus: HTMLElement | null
}

interface ContentEditorContextValue {
  editMode: boolean
  overrides: ContentOverrides
  changedCount: number
  storageAvailable: boolean
  toggleEditMode: () => void
  openEditor: (field: ActiveField) => void
  resetAll: () => void
}

const ContentEditorContext = createContext<ContentEditorContextValue | null>(null)

const emptyOverrides = (): ContentOverrides => Object.create(null) as ContentOverrides

const parseOverrides = (rawValue: string | null): ContentOverrides => {
  if (!rawValue) return emptyOverrides()

  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyOverrides()
    }

    const overrides = emptyOverrides()
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'string') overrides[key] = value
    })
    return overrides
  } catch {
    return emptyOverrides()
  }
}

const persistOverrides = (overrides: ContentOverrides): boolean => {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(overrides))
    return true
  } catch {
    return false
  }
}

const readInitialContent = (): {
  overrides: ContentOverrides
  storageAvailable: boolean
} => {
  if (typeof window === 'undefined') {
    return { overrides: emptyOverrides(), storageAvailable: false }
  }

  try {
    const overrides = parseOverrides(window.localStorage.getItem(CONTENT_STORAGE_KEY))
    return {
      overrides,
      storageAvailable: persistOverrides(overrides),
    }
  } catch {
    return { overrides: emptyOverrides(), storageAvailable: false }
  }
}

const hasOverride = (overrides: ContentOverrides, contentKey: string) =>
  Object.prototype.hasOwnProperty.call(overrides, contentKey)

const useContentEditor = () => {
  const context = useContext(ContentEditorContext)
  if (!context) {
    throw new Error('Content editor components must be used inside ContentEditorProvider.')
  }
  return context
}

export interface ContentEditorProviderProps {
  children: ReactNode
}

export function ContentEditorProvider({ children }: ContentEditorProviderProps) {
  const initialContent = useMemo(readInitialContent, [])
  const [overrides, setOverrides] = useState<ContentOverrides>(initialContent.overrides)
  const [storageAvailable, setStorageAvailable] = useState(initialContent.storageAvailable)
  const [editMode, setEditMode] = useState(false)
  const [activeField, setActiveField] = useState<ActiveField | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CONTENT_STORAGE_KEY) return
      setOverrides(parseOverrides(event.newValue))
      setStorageAvailable(true)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (!editMode || typeof document === 'undefined') return

    const preventLinkNavigation = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('a[href]')) {
        event.preventDefault()
      }
    }

    document.addEventListener('click', preventLinkNavigation, true)
    document.addEventListener('auxclick', preventLinkNavigation, true)
    return () => {
      document.removeEventListener('click', preventLinkNavigation, true)
      document.removeEventListener('auxclick', preventLinkNavigation, true)
    }
  }, [editMode])

  const toggleEditMode = useCallback(() => {
    setActiveField(null)
    setEditMode((current) => !current)
  }, [])

  const openEditor = useCallback((field: ActiveField) => {
    setActiveField(field)
  }, [])

  const saveValue = useCallback(
    (contentKey: string, defaultValue: string, nextValue: string) => {
      const currentlyOverridden = hasOverride(overrides, contentKey)
      let next = overrides

      if (nextValue === defaultValue) {
        if (currentlyOverridden) {
          next = Object.assign(emptyOverrides(), overrides)
          delete next[contentKey]
        }
      } else if (!currentlyOverridden || overrides[contentKey] !== nextValue) {
        next = Object.assign(emptyOverrides(), overrides, { [contentKey]: nextValue })
      }

      const persisted = persistOverrides(next)
      setStorageAvailable(persisted)
      if (persisted) setOverrides(next)
      return persisted
    },
    [overrides],
  )

  const restoreValue = useCallback(
    (contentKey: string) => {
      if (!hasOverride(overrides, contentKey)) return true
      const next = Object.assign(emptyOverrides(), overrides)
      delete next[contentKey]
      const persisted = persistOverrides(next)
      setStorageAvailable(persisted)
      if (persisted) setOverrides(next)
      return persisted
    },
    [overrides],
  )

  const resetAll = useCallback(() => {
    const next = emptyOverrides()
    const persisted = persistOverrides(next)
    setStorageAvailable(persisted)
    if (persisted) {
      setOverrides(next)
      setActiveField(null)
    }
  }, [])

  const contextValue = useMemo<ContentEditorContextValue>(
    () => ({
      editMode,
      overrides,
      changedCount: Object.keys(overrides).length,
      storageAvailable,
      toggleEditMode,
      openEditor,
      resetAll,
    }),
    [editMode, openEditor, overrides, resetAll, storageAvailable, toggleEditMode],
  )

  return (
    <ContentEditorContext.Provider value={contextValue}>
      {children}
      {activeField ? (
        <ContentEditorDialog
          key={activeField.contentKey}
          field={activeField}
          onCancel={() => setActiveField(null)}
          onRestore={() => {
            if (restoreValue(activeField.contentKey)) setActiveField(null)
          }}
          onSave={(nextValue) => {
            if (saveValue(activeField.contentKey, activeField.defaultValue, nextValue)) {
              setActiveField(null)
            }
          }}
        />
      ) : null}
    </ContentEditorContext.Provider>
  )
}

const toolbarStyle: CSSProperties = {
  position: 'fixed',
  right: 20,
  bottom: 20,
  zIndex: 40,
  display: 'grid',
  gap: 10,
  width: 'min(290px, calc(100vw - 32px))',
  padding: 14,
  border: '1px solid rgba(20, 20, 20, 0.18)',
  borderRadius: 14,
  background: 'rgba(255, 255, 255, 0.96)',
  color: '#171717',
  boxShadow: '0 16px 50px rgba(0, 0, 0, 0.2)',
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
  fontSize: 13,
  lineHeight: 1.4,
  backdropFilter: 'blur(10px)',
}

const toolbarButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: '8px 12px',
  border: '1px solid rgba(20, 20, 20, 0.24)',
  borderRadius: 9,
  background: '#171717',
  color: '#fff',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
}

export function ContentEditorToolbar() {
  const {
    changedCount,
    editMode,
    resetAll,
    storageAvailable,
    toggleEditMode,
  } = useContentEditor()

  const handleResetAll = () => {
    if (changedCount === 0 || typeof window === 'undefined') return
    const confirmed = window.confirm(
      `수정한 텍스트 ${changedCount}개를 모두 기본값으로 되돌릴까요?`,
    )
    if (confirmed) resetAll()
  }

  if (!editMode) {
    return (
      <aside
        className="content-editor-toolbar"
        style={{
          ...toolbarStyle,
          display: 'block',
          width: 'auto',
          padding: 0,
          borderRadius: 999,
        }}
        aria-label="페이지 텍스트 편집 도구"
      >
        <button
          className="content-editor-toolbar__toggle"
          type="button"
          aria-pressed="false"
          onClick={toggleEditMode}
          style={{
            ...toolbarButtonStyle,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            minHeight: 44,
            paddingInline: 16,
            border: 0,
            borderRadius: 999,
          }}
        >
          <span aria-hidden="true">✎</span>
          <span>텍스트 수정</span>
          {changedCount > 0 ? (
            <span
              className="content-editor-toolbar__count"
              aria-label={`변경 ${changedCount}개`}
              style={{
                minWidth: 20,
                padding: '1px 6px',
                borderRadius: 999,
                background: '#fff',
                color: '#171717',
                fontSize: 11,
              }}
            >
              {changedCount}
            </span>
          ) : null}
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="content-editor-toolbar content-editor-toolbar--active"
      style={toolbarStyle}
      aria-label="페이지 텍스트 편집 도구"
    >
      <div
        className="content-editor-toolbar__heading"
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}
      >
        <strong style={{ fontSize: 15 }}>텍스트 수정</strong>
        <span className="content-editor-toolbar__count" aria-live="polite">
          변경 {changedCount}개
        </span>
      </div>

      <p className="content-editor-toolbar__notice" style={{ margin: 0, color: '#575757' }}>
        수정할 문구나 옆의 연필을 누르세요.
        <br />
        수정 내용은 이 브라우저에만 자동 저장됩니다.
      </p>

      {!storageAvailable ? (
        <p
          className="content-editor-toolbar__storage-error"
          role="alert"
          style={{ margin: 0, color: '#a32121', fontWeight: 650 }}
        >
          브라우저 저장소를 사용할 수 없어 새로고침하면 변경 내용이 사라집니다.
        </p>
      ) : null}

      <div className="content-editor-toolbar__actions" style={{ display: 'flex', gap: 8 }}>
        <button
          className="content-editor-toolbar__toggle"
          type="button"
          aria-pressed={editMode}
          onClick={toggleEditMode}
          style={{ ...toolbarButtonStyle, flex: 1 }}
        >
          {editMode ? '수정 끝내기' : '수정 시작'}
        </button>
        <button
          className="content-editor-toolbar__reset"
          type="button"
          disabled={changedCount === 0}
          onClick={handleResetAll}
          style={{
            ...toolbarButtonStyle,
            background: '#fff',
            color: '#171717',
            cursor: changedCount === 0 ? 'not-allowed' : 'pointer',
            opacity: changedCount === 0 ? 0.45 : 1,
          }}
        >
          전체 복원
        </button>
      </div>
    </aside>
  )
}

export function useEditableValue(contentKey: string, defaultValue: string): string {
  const { overrides } = useContentEditor()
  return hasOverride(overrides, contentKey) ? overrides[contentKey] : defaultValue
}

export function useContentEditMode(): boolean {
  return useContentEditor().editMode
}

export interface EditableLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  editingAs?: 'div' | 'span'
}

export function EditableLink({
  children,
  editingAs = 'span',
  ...linkProps
}: EditableLinkProps) {
  const editMode = useContentEditMode()
  if (!editMode) return <a {...linkProps}>{children}</a>

  const {
    'aria-label': ariaLabel,
    download,
    href,
    hrefLang,
    onClick,
    ping,
    referrerPolicy,
    rel,
    target,
    type,
    ...editingProps
  } = linkProps
  void ariaLabel
  void download
  void href
  void hrefLang
  void onClick
  void ping
  void referrerPolicy
  void rel
  void target
  void type

  const style = { ...editingProps.style, cursor: 'default' }
  if (editingAs === 'div') {
    return (
      <div {...(editingProps as HTMLAttributes<HTMLDivElement>)} style={style}>
        {children}
      </div>
    )
  }
  return (
    <span {...(editingProps as HTMLAttributes<HTMLSpanElement>)} style={style}>
      {children}
    </span>
  )
}

export interface EditableTextProps {
  contentKey: string
  label: string
  defaultValue: string
  as?: ElementType
  multiline?: boolean
  className?: string
  style?: CSSProperties
  render?: (value: string) => ReactNode
  validate?: (value: string) => string | null
}

const pencilStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  marginInlineStart: 7,
  border: '1px solid currentColor',
  borderRadius: 999,
  background: '#fff4c2',
  color: '#171717',
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
  fontSize: 12,
  fontStyle: 'normal',
  fontWeight: 800,
  lineHeight: 1,
  verticalAlign: 2,
}

export function EditableText({
  contentKey,
  label,
  defaultValue,
  as: Tag = 'span',
  multiline = false,
  className = '',
  style,
  render,
  validate,
}: EditableTextProps) {
  const { editMode, openEditor, overrides } = useContentEditor()
  const value = useEditableValue(contentKey, defaultValue)
  const modified = hasOverride(overrides, contentKey)

  const startEditing = (returnFocus: HTMLElement) => {
    openEditor({
      contentKey,
      label,
      defaultValue,
      value,
      multiline,
      validate,
      returnFocus,
    })
  }

  const handleClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!editMode) return
    event.preventDefault()
    event.stopPropagation()
    startEditing(event.currentTarget)
  }

  const handleAuxClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!editMode) return
    event.preventDefault()
    event.stopPropagation()
  }

  const handleKeyDownCapture = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!editMode || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    event.stopPropagation()
    startEditing(event.currentTarget)
  }

  const classes = [
    'content-editor-editable',
    editMode ? 'content-editor-editable--active' : '',
    modified ? 'content-editor-editable--modified' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      style={{
        ...(multiline ? { whiteSpace: 'pre-line' as const } : null),
        ...(editMode
          ? {
              cursor: 'pointer',
              outline: '2px dashed rgba(181, 105, 0, 0.68)',
              outlineOffset: 3,
            }
          : null),
        ...style,
      }}
      data-content-key={contentKey}
      data-content-modified={modified ? 'true' : undefined}
      role={editMode ? 'button' : undefined}
      tabIndex={editMode ? 0 : undefined}
      aria-label={editMode ? `${label} 수정` : undefined}
      onClickCapture={handleClickCapture}
      onAuxClickCapture={handleAuxClickCapture}
      onKeyDownCapture={handleKeyDownCapture}
    >
      {render ? render(value) : value}
      {editMode ? (
        <span
          className="content-editor-editable__marker"
          style={pencilStyle}
          aria-hidden="true"
        >
          ✎
        </span>
      ) : null}
    </Tag>
  )
}

interface ContentEditorDialogProps {
  field: ActiveField
  onCancel: () => void
  onRestore: () => void
  onSave: (value: string) => void
}

const dialogStyle: CSSProperties = {
  width: 'min(560px, calc(100vw - 32px))',
  maxWidth: '100%',
  padding: 0,
  border: '1px solid rgba(20, 20, 20, 0.2)',
  borderRadius: 16,
  background: '#fff',
  color: '#171717',
  boxShadow: '0 24px 90px rgba(0, 0, 0, 0.38)',
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
}

const fieldStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid #aaa',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  font: 'inherit',
  fontSize: 16,
  lineHeight: 1.5,
}

function ContentEditorDialog({
  field,
  onCancel,
  onRestore,
  onSave,
}: ContentEditorDialogProps) {
  const { storageAvailable } = useContentEditor()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [draft, setDraft] = useState(field.value)
  const [validationError, setValidationError] = useState<string | null>(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  const titleId = useId()
  const descriptionId = useId()
  const inputId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const fallbackSiblings: Array<{ element: HTMLElement; inert: boolean }> = []
    let fallbackKeyDown: ((event: KeyboardEvent) => void) | null = null

    try {
      if (!dialog.open) dialog.showModal()
    } catch {
      dialog.setAttribute('open', '')
      dialog.classList.add('content-editor-dialog--fallback')
      Array.from(dialog.parentElement?.children ?? []).forEach((sibling) => {
        if (sibling === dialog || !(sibling instanceof HTMLElement)) return
        fallbackSiblings.push({ element: sibling, inert: sibling.inert })
        sibling.inert = true
      })
      fallbackKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelRef.current()
          return
        }
        if (event.key !== 'Tab') return
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusable.length === 0) {
          event.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
      dialog.addEventListener('keydown', fallbackKeyDown)
    }

    const focusTimer = window.setTimeout(() => {
      editorRef.current?.focus()
      editorRef.current?.select()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      if (dialog.open) dialog.close()
      if (fallbackKeyDown) dialog.removeEventListener('keydown', fallbackKeyDown)
      fallbackSiblings.forEach(({ element, inert }) => {
        element.inert = inert
      })
      window.setTimeout(() => {
        if (field.returnFocus?.isConnected) field.returnFocus.focus()
      }, 0)
    }
  }, [field.returnFocus])

  const handleEditorKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submitDraft()
    }
  }

  const submitDraft = () => {
    const nextError = field.validate?.(draft) ?? null
    setValidationError(nextError)
    if (!nextError) onSave(draft)
  }

  return (
    <dialog
      ref={dialogRef}
      className="content-editor-dialog"
      style={dialogStyle}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <form
        className="content-editor-dialog__form"
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault()
          submitDraft()
        }}
        style={{ display: 'grid', gap: 16, padding: 22 }}
      >
        <div className="content-editor-dialog__heading">
          <h2 id={titleId} style={{ margin: 0, fontSize: 20 }}>
            {field.label} 수정
          </h2>
          <p
            id={descriptionId}
            role={storageAvailable ? undefined : 'alert'}
            style={{
              margin: '6px 0 0',
              color: storageAvailable ? '#626262' : '#a32121',
              fontSize: 13,
              fontWeight: storageAvailable ? 400 : 650,
            }}
          >
            {storageAvailable
              ? '저장하면 이 브라우저에만 자동 저장됩니다. Ctrl/Cmd + Enter로 저장할 수 있습니다.'
              : '브라우저 저장소를 사용할 수 없어 저장할 수 없습니다. 설정을 확인한 뒤 다시 시도해 주세요.'}
          </p>
        </div>

        <div className="content-editor-dialog__field" style={{ display: 'grid', gap: 7 }}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>
            {field.label}
          </label>
          {field.multiline ? (
            <textarea
              ref={editorRef as React.RefObject<HTMLTextAreaElement | null>}
              id={inputId}
              value={draft}
              rows={7}
              aria-invalid={validationError ? 'true' : undefined}
              aria-describedby={validationError ? `${inputId}-error` : undefined}
              onChange={(event) => {
                setDraft(event.target.value)
                setValidationError(null)
              }}
              onKeyDown={handleEditorKeyDown}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          ) : (
            <input
              ref={editorRef as React.RefObject<HTMLInputElement | null>}
              id={inputId}
              type="text"
              value={draft}
              aria-invalid={validationError ? 'true' : undefined}
              aria-describedby={validationError ? `${inputId}-error` : undefined}
              onChange={(event) => {
                setDraft(event.target.value)
                setValidationError(null)
              }}
              onKeyDown={handleEditorKeyDown}
              style={fieldStyle}
            />
          )}
          {validationError ? (
            <p id={`${inputId}-error`} role="alert" style={{ margin: 0, color: '#a32121', fontSize: 13 }}>
              {validationError}
            </p>
          ) : null}
        </div>

        <div
          className="content-editor-dialog__actions"
          style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}
        >
          <button
            className="content-editor-dialog__restore"
            type="button"
            onClick={onRestore}
            disabled={field.value === field.defaultValue}
            style={{
              ...toolbarButtonStyle,
              marginRight: 'auto',
              background: '#fff',
              color: '#171717',
              opacity: field.value === field.defaultValue ? 0.45 : 1,
              cursor: field.value === field.defaultValue ? 'not-allowed' : 'pointer',
            }}
          >
            기본값으로 복원
          </button>
          <button
            className="content-editor-dialog__cancel"
            type="button"
            onClick={onCancel}
            style={{ ...toolbarButtonStyle, background: '#fff', color: '#171717' }}
          >
            취소
          </button>
          <button
            className="content-editor-dialog__save"
            type="submit"
            style={toolbarButtonStyle}
          >
            저장
          </button>
        </div>
      </form>
    </dialog>
  )
}
