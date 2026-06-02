/* Shared atoms + tiny utilities */
import { useEffect, useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'

export const useReveal = () => {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('in')
            io.unobserve(el)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

interface RevealProps {
  children: ReactNode
  delay?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
  [key: string]: unknown
}

export const Reveal = ({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  style = {},
  ...rest
}: RevealProps) => {
  const ref = useReveal()
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// A monospace caption with leading bullet
export const Eyebrow = ({ children, color }: { children: ReactNode; color?: string }) => (
  <div
    style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: color || 'var(--muted)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--accent)',
      }}
    />
    {children}
  </div>
)

// A clean horizontal hairline
export const Rule = ({ style }: { style?: CSSProperties }) => (
  <div style={{ height: 1, background: 'var(--line)', width: '100%', ...style }} />
)

// Arrow icon
export const Arrow = ({ size = 14, rotate = 0 }: { size?: number; rotate?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    style={{
      transform: `rotate(${rotate}deg)`,
      transition: 'transform 0.4s cubic-bezier(0.2,0.7,0.2,1)',
    }}
  >
    <path
      d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Live dot
export const LiveDot = ({ color = 'var(--accent)' }: { color?: string }) => (
  <span
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color,
      animation: 'pulseDot 1.8s ease-out infinite',
    }}
  />
)
