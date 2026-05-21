import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'

export default function ThemeToggle() {
  const { isDark, toggleDark } = useStore()

  return (
    <div className="fixed top-4 right-4 z-50">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleDark}
        className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl shadow-md"
        aria-label="Toggle theme"
      >
        {isDark ? '☀️' : '🌙'}
      </motion.button>
    </div>
  )
}
