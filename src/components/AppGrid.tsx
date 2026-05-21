import { motion } from 'framer-motion'
import AppCard from './AppCard'
import { apps } from '../apps.config'

export default function AppGrid() {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-20">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xl font-semibold mb-6 text-gray-700 dark:text-gray-300"
      >
        앱 목록
      </motion.h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {apps.map((app, i) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
          >
            <AppCard app={app} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
