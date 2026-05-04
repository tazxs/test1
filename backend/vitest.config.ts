import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: [
      // nalogai-shared subpaths must come before the package root alias
      { find: /^nalogai-shared\/(.*)/, replacement: resolve(__dirname, '../shared/$1') },
      { find: 'nalogai-shared', replacement: resolve(__dirname, '../shared') },
      { find: '@services', replacement: resolve(__dirname, 'src/services') },
      { find: '@middleware', replacement: resolve(__dirname, 'src/middleware') },
      { find: '@utils', replacement: resolve(__dirname, 'src/utils') },
      { find: '@routes', replacement: resolve(__dirname, 'src/routes') },
      { find: '@jobs', replacement: resolve(__dirname, 'src/jobs') },
      { find: /^@\/(.*)/, replacement: resolve(__dirname, 'src/$1') },
    ],
  },
})
