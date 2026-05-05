/**
 * Vercel Serverless Function entry point.
 *
 * Imports the compiled Express app from a local copy of backend/dist
 * that is flattened into api/backend-dist/ during the build step.
 *
 * Build flow:
 *   1. npm install --include=dev
 *   2. npm run build --workspace=shared   → shared constants (MRP = 4,325 ₸)
 *   3. npx prisma generate                → Prisma Client in node_modules/.prisma
 *   4. npm run build --workspace=backend  → backend/dist/app.js
 *   5. mkdir -p api/backend-dist && cp -r backend/dist/* api/backend-dist/
 *   6. npm run build --workspace=frontend → frontend/dist/
 *
 * At runtime, __dirname = /var/task/api, so ./backend-dist/app resolves to
 * /var/task/api/backend-dist/app.js — inside the Lambda bundle.
 *
 * Trust proxy is set to 1 in app.ts for correct IP extraction behind Vercel.
 */

const path = require('path')
const fs = require('fs')

// Diagnostic: log directory structure on cold start (remove after verification)
const backendDistPath = path.join(__dirname, 'backend-dist')
if (!fs.existsSync(backendDistPath)) {
  console.error('[api/index.js] backend-dist NOT FOUND at:', backendDistPath)
  console.error('[api/index.js] __dirname contents:', fs.readdirSync(__dirname))
  console.error('[api/index.js] process.cwd():', process.cwd())
}

const { app } = require('./backend-dist/app')

module.exports = app
