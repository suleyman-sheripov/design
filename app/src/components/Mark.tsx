import { H_PATH, S_PATH, LOWER_PATH, SH_SPACING } from '../lib/logoPaths'

export function Mark({ className }: { className?: string }) {
  return <svg viewBox={`244.84049 60 ${945.35951 + SH_SPACING} 600`} xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <g fill="currentColor"><path d={S_PATH} /><path d={LOWER_PATH} /><path d={H_PATH} transform={`translate(${SH_SPACING} 0)`} /></g>
  </svg>
}
