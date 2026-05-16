#!/usr/bin/env node
import { startServer } from './server.js'

startServer().catch((err) => {
  console.error('[release-updater] startup failed:', err)
  process.exit(1)
})
