import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { resolve } from 'path'

const sentryAuthToken = process.env['SENTRY_AUTH_TOKEN']
const sentryOrg = process.env['SENTRY_ORG']
const sentryProject = process.env['SENTRY_PROJECT']
const sentryEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject)

export default defineConfig({
  plugins: [
    react(),
    ...(sentryEnabled
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            sourcemaps: {
              filesToDeleteAfterUpload: ['dist/**/*.map'],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@store': resolve(__dirname, 'src/store'),
      '@api': resolve(__dirname, 'src/api'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@mocks': resolve(__dirname, 'src/mocks'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@services': resolve(__dirname, 'src/services'),
      // Shared workspace package — resolves directly to source (no build step needed)
      'nalogai-shared': resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: sentryEnabled ? 'hidden' : false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'animation-vendor': ['framer-motion'],
          'chart-vendor': ['recharts'],
          'form-vendor': ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
