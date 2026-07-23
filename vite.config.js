import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages URLs are case-sensitive on the repo-name path segment — this
// must match the actual repo name (Climate-Risk-Map) exactly.
export default defineConfig({
  plugins: [react()],
  base: '/Climate-Risk-Map/',
})
