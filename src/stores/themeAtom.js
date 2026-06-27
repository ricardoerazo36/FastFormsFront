import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import { useEffect } from 'react'
import { useAtomValue } from 'jotai'

export const THEME_STORAGE_KEY = 'fastforms:theme'

export const THEME_OPTIONS = ['light', 'dark', 'system']

export const themeAtom = atomWithStorage(
  THEME_STORAGE_KEY,
  'system',
  createJSONStorage(() => localStorage),
  { getOnInit: true },
)

const getSystemPrefersDark = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const resolvedThemeAtom = atom((get) => {
  const choice = get(themeAtom)
  if (choice === 'system') {
    return getSystemPrefersDark() ? 'dark' : 'light'
  }
  return choice === 'dark' ? 'dark' : 'light'
})

export const useThemeApplier = () => {
  const resolved = useAtomValue(resolvedThemeAtom)
  const choice = useAtomValue(themeAtom)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    document.documentElement.dataset.theme = resolved
    return undefined
  }, [resolved])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    if (choice !== 'system') return undefined

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event) => {
      document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [choice])
}
