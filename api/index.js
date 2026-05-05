/**
 * Vercel Serverless Function entry point.
 *
 * The build step copies backend/dist/* directly into api/ so that
 * app.js, services/, routes/, middleware/, utils/ etc. are all siblings
 * of this file. This allows ncc to bundle everything correctly.
 *
 * Build flow:
 *   1. npm install --include=dev
 *   2. npm run build --workspace=shared   → shared constants (MRP = 4,325 ₸)
 *   3. npx prisma generate                → Prisma Client
 *   4. npm run build --workspace=backend  → backend/dist/
 *   5. cp -r backend/dist/* api/          ← flatten into function directory
 *   6. npm run build --workspace=frontend → frontend/dist/
 *
 * At runtime, require('./app') resolves to /var/task/api/app.js
 * Trust proxy is set to 1 in app.ts for correct IP extraction behind Vercel.
 */

const { app } = require('./app')

module.exports = app
