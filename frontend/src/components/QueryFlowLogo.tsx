/**
 * Datopia brand logo mark — scales via the `size` prop.
 * Renders as an SVG badge (no external assets needed).
 */
interface Props {
  size?: number
  /** Pass a unique id suffix when rendering multiple logos on the same page */
  idSuffix?: string
}

export default function QueryFlowLogo({ size = 36, idSuffix = '0' }: Props) {
  const gradId = `dt-grad-${idSuffix}`
  const glowId = `dt-glow-${idSuffix}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Datopia logo"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Badge background */}
      <rect width="44" height="44" rx="11" fill={`url(#${gradId})`} />

      {/* Subtle inner highlight at top */}
      <rect x="0" y="0" width="44" height="22" rx="11" fill="white" fillOpacity="0.06" />

      {/* Icon: three data rows → flow chevron */}
      <rect x="8" y="13.5" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="8" y="20.5" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="8" y="27.5" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.95" />

      {/* Vertical separator */}
      <line x1="26" y1="12" x2="26" y2="32" stroke="white" strokeOpacity="0.2" strokeWidth="1" />

      {/* Flow chevron — right side */}
      <path
        d="M29 15.5 L36.5 22 L29 28.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.95"
      />

      {/* Small connector dot */}
      <circle cx="26" cy="22" r="2" fill="white" fillOpacity="0.45" />
    </svg>
  )
}

/** Inline wordmark: logo badge + "Datopia" text side-by-side */
interface WordmarkProps {
  size?: number
  theme?: 'light' | 'dark'
  idSuffix?: string
}

export function QueryFlowWordmark({ size = 32, theme = 'dark', idSuffix = '0' }: WordmarkProps) {
  const textColor = theme === 'light' ? '#ffffff' : '#0f172a'
  const subColor  = theme === 'light' ? 'rgba(255,255,255,0.65)' : '#64748b'

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <QueryFlowLogo size={size} idSuffix={idSuffix} />
      <span className="flex flex-col leading-none">
        <span
          style={{ color: textColor, fontSize: size * 0.47, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}
        >
          Dato<span style={{ color: theme === 'light' ? 'rgba(255,255,255,0.75)' : '#2563EB' }}>pia</span>
        </span>
        <span style={{ color: subColor, fontSize: size * 0.28, letterSpacing: '0.01em', lineHeight: 1.3 }}>
          Imagine. Build. Flow.
        </span>
      </span>
    </span>
  )
}
