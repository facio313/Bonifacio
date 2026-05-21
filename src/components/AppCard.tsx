import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import type { App } from '../types/app'

interface Props {
  app: App
}

export default function AppCard({ app }: Props) {
  const { openApp } = useStore()

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col gap-4 overflow-hidden shadow-sm hover:shadow-lg dark:hover:shadow-gray-900 transition-shadow duration-200"
    >
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: app.color }}
      />

      <div className="flex items-start gap-3">
        <span className="text-4xl leading-none">{app.icon}</span>
        <div className="min-w-0">
          <h3 className="font-semibold text-lg leading-tight truncate">{app.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {app.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {app.tags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-0.5 text-xs rounded-full font-medium"
            style={{ backgroundColor: `${app.color}22`, color: app.color }}
          >
            {tag}
          </span>
        ))}
      </div>

      {app.href ? (
        <motion.a
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          href={app.href}
          className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer text-center"
          style={{ backgroundColor: app.color }}
        >
          열기
        </motion.a>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => openApp(app)}
          className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ backgroundColor: app.color }}
        >
          열기
        </motion.button>
      )}
    </motion.div>
  )
}
