import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apps } from './src/apps.config'

const proxyEntries = Object.fromEntries([
  ...apps.map((app) => [
    `/proxy/${app.id}`,
    {
      target: `http://localhost:${app.port}`,
      changeOrigin: true,
      rewrite: (path: string) =>
        path.replace(new RegExp(`^/proxy/${app.id}`), ''),
    },
  ]),
  ...apps
    .filter((app) => app.href)
    .map((app) => [
      app.href!,
      {
        target: `http://localhost:${app.port}`,
        changeOrigin: true,
      },
    ]),
])

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: proxyEntries,
  },
})
