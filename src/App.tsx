import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './store/useStore'
import HeroSection from './components/HeroSection'
import AppGrid from './components/AppGrid'
import IframeView from './components/IframeView'
import ThemeToggle from './components/ThemeToggle'

export default function App() {
  const { selectedApp, initDark } = useStore()

  useEffect(() => {
    initDark()
  }, [initDark])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <AnimatePresence mode="wait">
        {selectedApp ? (
          <IframeView key="iframe" app={selectedApp} />
        ) : (
          <div key="home">
            <ThemeToggle />
            <HeroSection />
            <AppGrid />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
