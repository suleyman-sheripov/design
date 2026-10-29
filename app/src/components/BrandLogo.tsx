import { useId } from 'react'
import { H_PATH, S_PATH, LOWER_PATH, WORD_PATH } from '../lib/logoPaths'
import type { IntroFrame } from '../lib/introSim'

// The viewBox includes the O's optical overshoot; no typeset substitute is used.
export const LOGO_VIEWBOX = '242.84049 52 4604.65951 616'
export function BrandLogo({ frame, className = '' }: { frame?: IntroFrame; className?: string }) {
  const id = useId().replace(/:/g, '')
  const s = `${id}-s`, h = `${id}-h`, word = `${id}-word`
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={LOGO_VIEWBOX} className={className} aria-hidden="true" focusable="false">
    {frame && <defs>
      <mask id={s} maskUnits="userSpaceOnUse" x="230" y="40" width="500" height="640">
        <path d="M445 32 C337 76 298 163 337 247 C363 302 429 328 494 367 L573 414 C643 456 662 524 610 690" fill="none" stroke="white" strokeWidth="280" strokeLinecap="butt" pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - frame.stroke} />
      </mask>
      <clipPath id={h}>
        <rect x="630" y="60" width="185" height={600 * frame.hLeft} />
        <rect x="810" y="350" width={210 * frame.hCross} height="140" />
        <rect x="1018" y={660 - 600 * frame.hRight} width="174" height={600 * frame.hRight} />
      </clipPath>
      <clipPath id={word}><rect x="1200" y="40" width={Math.max(0, frame.wordEdge - 1200)} height="640" /></clipPath>
    </defs>}
    <g transform={frame ? `translate(${frame.offset} 0)` : undefined} fill="currentColor">
      <path d={S_PATH} mask={frame && frame.stroke < 1 ? `url(#${s})` : undefined} />
      <path d={LOWER_PATH} style={frame ? { clipPath: `inset(${(1 - frame.lower) * 100}% 0 0 0)` } : undefined} />
      <path d={H_PATH} clipPath={frame && frame.hRight < 1 ? `url(#${h})` : undefined} />
      <path d={WORD_PATH} clipPath={frame && frame.dotX < 4759.5 ? `url(#${word})` : undefined} visibility={frame && !frame.wordVisible ? 'hidden' : undefined} />
      <circle className="logo-terminal-dot" cx={frame?.dotX ?? 4759.5} cy="574" r={86 * (frame?.dot ?? 1)} fill="var(--color-sky, #2f6182)" />
    </g>
  </svg>
}
