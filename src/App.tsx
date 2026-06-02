import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './store/useStore'
import { DotNav } from './components/Nav'
import { Profile } from './components/sections/Profile'
import { About } from './components/sections/About'
import { Works } from './components/sections/Works'
import { Contact } from './components/sections/Contact'
import IframeView from './components/IframeView'

export default function App() {
  const selectedApp = useStore((s) => s.selectedApp)

  // Hide the loading splash shortly after mount.
  useEffect(() => {
    const t = setTimeout(() => document.getElementById('splash')?.classList.add('gone'), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <DotNav />
      <Profile />
      <About />
      <Works />
      <Contact />

      {/* Real apps open over the portfolio in a full-screen iframe. */}
      <AnimatePresence>
        {selectedApp && <IframeView key="iframe" app={selectedApp} />}
      </AnimatePresence>
    </>
  )
}
