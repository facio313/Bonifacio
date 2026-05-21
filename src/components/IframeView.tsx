import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import type { App } from '../types/app'

interface Props {
  app: App
}

export default function IframeView({ app }: Props) {
  const { closeApp } = useStore()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex flex-col"
    >
      <div
        className="flex items-center gap-3 px-4 h-10 shrink-0 select-none"
        style={{ backgroundColor: app.color }}
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={closeApp}
          className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium cursor-pointer"
        >
          ← 돌아가기
        </motion.button>
        <span className="text-white/50 select-none">|</span>
        <span className="text-white text-sm font-semibold">
          {app.icon} {app.title}
        </span>
      </div>

      <iframe
        src={`/proxy/${app.id}/`}
        className="flex-1 w-full border-none bg-white"
        title={app.title}
        allow="clipboard-read; clipboard-write"
      />
    </motion.div>
  )
}
