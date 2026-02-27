import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Base path can be set via VITE_BASE_PATH env variable:
//   - "/" (default) for root-hosted deployments
//   - "/FlowState-TM/" for path-prefixed deployments (e.g. GitHub Pages with project site)
export default defineConfig(({ mode }) => {
  // @ts-expect-error -- process.cwd() is valid at build time in Node
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "/",
  }
})
