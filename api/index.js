/**
 * Vercel Serverless Function entry point.
 *
 * This thin wrapper imports the compiled Express app from the backend workspace
 * and re-exports it as the default handler for Vercel's Node.js runtime.
 *
 * Build flow:
 *   1. npm install (all workspaces)
 *   2. npm run build --workspace=shared
 *   3. npm run build --workspace=backend  → backend/dist/
 *   4. npm run build --workspace=frontend → frontend/dist/
 *
 * The vercel.json rewrite routes /api/:path* → /api (this function).
 */

const { app } = require('../backend/dist/app')

module.exports = app
