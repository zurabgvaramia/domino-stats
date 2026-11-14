import { useEffect, useState } from 'react'

export function useWide(query = '(min-width: 840px)') {
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setWide(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return wide
}
