/**
 * 朋友本地配置加载: ~/.release-updater/config.json
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { UpdaterConfig } from '../types.js'

export function getUpdaterDir(): string {
  return process.env.UPDATER_HOME ?? join(homedir(), '.release-updater')
}

export function getConfigPath(): string {
  return join(getUpdaterDir(), 'config.json')
}

export function loadConfig(): UpdaterConfig {
  const path = getConfigPath()
  if (!existsSync(path)) {
    throw new Error(`config 不存在: ${path}\n请先跑 install.sh`)
  }
  const st = statSync(path)
  if ((st.mode & 0o077) !== 0) {
    console.warn(`[config] 警告: ${path} 权限不是 600 (实际 ${(st.mode & 0o777).toString(8)})`)
  }
  const raw = readFileSync(path, 'utf-8')
  const cfg: UpdaterConfig = JSON.parse(raw)
  validate(cfg)
  return cfg
}

function validate(c: UpdaterConfig): void {
  const required: (keyof UpdaterConfig)[] = [
    'friend_id',
    'feishu_app_id',
    'feishu_app_secret',
    'updater_token',
    'github_token',
    'bridge_chat_id',
    'projects',
  ]
  for (const k of required) {
    if (!c[k]) throw new Error(`config 缺少必填字段: ${k}`)
  }
  if (typeof c.projects !== 'object') {
    throw new Error('config.projects 必须是对象')
  }
}

export function resolveInstallPath(cfg: UpdaterConfig, project: string): string | null {
  const p = cfg.projects[project]
  return p?.install_path
    ? p.install_path.replace(/^~/, homedir())
    : null
}
