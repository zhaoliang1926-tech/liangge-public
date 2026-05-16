/**
 * 状态持久化: ~/.release-updater/state.json
 */

import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ActiveRelease } from '../types.js'
import { getUpdaterDir } from './config.js'

function statePath(): string {
  return join(getUpdaterDir(), 'state.json')
}

export function saveState(state: ActiveRelease | null): void {
  const path = statePath()
  mkdirSync(getUpdaterDir(), { recursive: true, mode: 0o700 })
  if (state === null) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  const tmp = `${path}.tmp.${process.pid}`
  writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmp, path)
}

export function loadState(): ActiveRelease | null {
  const path = statePath()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

export function clearState(): void {
  saveState(null)
}
