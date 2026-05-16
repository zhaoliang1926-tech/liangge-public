/**
 * 备份当前 install_path → install_path.bak-<ts>/
 * 保留最近 7 天，老的自动清理
 */

import { existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, basename, join } from 'node:path'
import { execa } from 'execa'

const BACKUP_RETAIN_DAYS = 7

function tsStr(): string {
  return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
}

export async function backupInstallPath(installPath: string): Promise<string | null> {
  if (!existsSync(installPath)) return null
  const backupPath = `${installPath}.bak-${tsStr()}`
  await execa('cp', ['-R', installPath, backupPath])
  return backupPath
}

export async function restoreFromBackup(installPath: string, backupPath: string): Promise<void> {
  if (!existsSync(backupPath)) throw new Error(`备份不存在: ${backupPath}`)
  if (existsSync(installPath)) {
    await execa('rm', ['-rf', installPath])
  }
  await execa('cp', ['-R', backupPath, installPath])
}

export function pruneOldBackups(installPath: string): string[] {
  const parent = dirname(installPath)
  const base = basename(installPath)
  if (!existsSync(parent)) return []
  const cutoff = Date.now() - BACKUP_RETAIN_DAYS * 24 * 60 * 60 * 1000
  const pruned: string[] = []
  for (const name of readdirSync(parent)) {
    if (!name.startsWith(`${base}.bak-`)) continue
    const full = join(parent, name)
    try {
      const st = statSync(full)
      if (st.isDirectory() && st.mtimeMs < cutoff) {
        execa('rm', ['-rf', full])
        pruned.push(full)
      }
    } catch {
      // skip
    }
  }
  return pruned
}
