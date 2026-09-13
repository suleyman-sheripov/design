import { useEffect, useState } from 'react'

/* Есть ли настоящий указатель и разрешено ли движение. Один ответ на
   весь сайт, потому что от него зависят сразу и свой курсор, и
   жижа под кнопкой: разойдись эти два ответа, кнопка отдала бы
   заливку слою, которого нет, и стала бы невидимой. Ровно это и
   случилось на ванильной версии — на всех сенсорных экранах. */
export function useFinePointer() {
  const [fine, setFine] = useState(false)

  useEffect(() => {
    const q = matchMedia('(hover: hover) and (pointer: fine)')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')

    const check = () => setFine(q.matches && !motion.matches)
    check()

    q.addEventListener('change', check)
    motion.addEventListener('change', check)
    return () => {
      q.removeEventListener('change', check)
      motion.removeEventListener('change', check)
    }
  }, [])

  return fine
}
