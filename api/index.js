/**
 * Vercel Serverless Function entry point.
 *
 * Uses an INDIRECT require to bypass Vercel's ncc bundler static analysis.
 * ncc tries to resolve all require() calls at build time, but backend/dist/
 * is only available at runtime (copied by includeFiles in vercel.json).
 *
 * The `(0, require)(path)` pattern makes the call indirect, preventing ncc
 * from attempting static resolution while still working at runtime.
 *
 * Build flow:
 *   1. npm install --include=dev
 *   2. npm run build --workspace=shared   → shared constants (MRP = 4,325 ₸)
 *   3. npx prisma generate                → Prisma Client in node_modules/.prisma
 *   4. npm run build --workspace=backend  → backend/dist/app.js
 *   5. npm run build --workspace=frontend → frontend/dist/
 *
 * Trust proxy is set to 1 in app.ts for correct IP extraction behind Vercel.
 */

const path = require('path')

// Indirect require — bypasses ncc static analysis
// At runtime, __dirname = /var/task/api, so ../backend/dist/app resolves correctly
const backendAppPath = path.join(__dirname, '..', 'backend', 'dist', 'app')
const { app } = (0, require)(backendAppPath)

module.exports = app
