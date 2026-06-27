import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai'
// eslint-disable-next-line no-unused-vars -- usado como <motion.*> en JSX
import { AnimatePresence, motion } from 'framer-motion'
import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi'
import { THEME_OPTIONS, themeAtom } from '../stores/themeAtom'
import './ThemeToggle.css'

const ICON_BY_THEME = {
  light: FiSun,
  dark: FiMoon,
  system: FiMonitor,
}

const LABEL_BY_THEME = {
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Sistema',
}

const iconMotion = {
  initial: { opacity: 0, rotate: -90, scale: 0.6 },
  animate: { opacity: 1, rotate: 0, scale: 1 },
  exit: { opacity: 0, rotate: 90, scale: 0.6 },
}

const menuMotion = {
  initial: { opacity: 0, y: -6, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.96 },
}

const ThemeToggle = () => {
  const [theme, setTheme] = useAtom(themeAtom)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const ActiveIcon = ICON_BY_THEME[theme] ?? FiMonitor

  return (
    <div className="theme-toggle" ref={containerRef}>
      <button
        type="button"
        className="theme-toggle-button"
        aria-label={`Tema actual: ${LABEL_BY_THEME[theme]}. Cambiar tema`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            className="theme-toggle-icon"
            initial={iconMotion.initial}
            animate={iconMotion.animate}
            exit={iconMotion.exit}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ActiveIcon size={18} />
          </motion.span>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            key="theme-menu"
            role="menu"
            aria-label="Seleccionar tema"
            className="theme-toggle-menu"
            initial={menuMotion.initial}
            animate={menuMotion.animate}
            exit={menuMotion.exit}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {THEME_OPTIONS.map((option) => {
              const OptionIcon = ICON_BY_THEME[option]
              const isActive = option === theme
              return (
                <li key={option} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`theme-toggle-option${isActive ? ' is-active' : ''}`}
                    onClick={() => {
                      setTheme(option)
                      setOpen(false)
                    }}
                  >
                    <OptionIcon size={16} />
                    <span>{LABEL_BY_THEME[option]}</span>
                  </button>
                </li>
              )
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default ThemeToggle
