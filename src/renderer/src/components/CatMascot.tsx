// Gatito durmiente estilo Dahia (line-art rosa). Vectorial para que escale nítido.
export function CatMascot({ size = 120 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* cuerpo enroscado */}
      <path d="M60 140c-24-6-36-30-30-54 6-26 32-42 58-36 20 5 33 22 33 41" opacity="0.9" />
      <path d="M121 91c10 2 20 10 24 22 6 18-2 34-18 40-10 4-40 4-58-3" opacity="0.9" />
      {/* cabeza */}
      <path d="M121 91c-6-4-9-11-8-18 1-8 8-16 18-17" />
      {/* orejas */}
      <path d="M131 56l-2-16 14 10M149 60l12-9 1 16" />
      {/* ojo dormido */}
      <path d="M120 74c3 3 8 3 11 0" />
      {/* naricita */}
      <circle cx="139" cy="80" r="2.4" fill="var(--primary)" stroke="none" />
      {/* colita */}
      <path d="M70 150c14 6 26 2 30-8" opacity="0.9" />
      {/* estrellita */}
      <path
        d="M165 44l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"
        fill="var(--primary-soft)"
        stroke="none"
        opacity="0.9"
      />
    </svg>
  )
}
