/**
 * Vercel Serverless Function entry point.
 *
 * This file imports the compiled Express app from a local copy of backend/dist
 * that is placed here during the build step (see vercel.json buildCommand).
 *
 * Build flow:
 *   1. npm install --include=dev
 *   2. npm run build --workspace=shared   → shared constants (MRP = 4,325 ₸)
 *   3. npx prisma generate                → Prisma Client
 *   4. npm run build --workspace=backend  → backend/dist/
 *   5. cp -r backend/dist api/backend-dist  ← copies compiled backend here
 *   6. npm run build --workspace=frontend → frontend/dist/
 *
 * At runtime, __dirname = /var/task/api, so ./backend-dist/app resolves correctly.
 * Trust proxy is set to 1 in app.ts for correct IP extraction behind Vercel.
 */

const { app } = require('./backend-dist/app')

module.exports = app
