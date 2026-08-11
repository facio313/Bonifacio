import { useEffect } from 'react'
import { DotNav } from './components/Nav'
import { Profile } from './components/sections/Profile'
import { About } from './components/sections/About'
import { Works } from './components/sections/Works'
import { Contact } from './components/sections/Contact'

export default function App() {
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
    </>
  )
}
