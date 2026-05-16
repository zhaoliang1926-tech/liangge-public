/**
 * 主流程编排: 收到 release_command → 5 阶段执行 → 上报
 */

import { join } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import type { ActiveRelease, ReleaseCommand, UpdaterConfig } from '../types.js'
import { resolveInstallPath, getUpdaterDir } from './config.js'
import { saveState, clearState } from './state.js'
import { report } from './reporter.js'
import { downloadTarball } from './downloader.js'
import { scanExtractedDir, verifySha256 } from './verifier.js'
import { backupInstallPath, pruneOldBackups, restoreFromBackup } from './backup.js'
import { extractTarball, mergeWithPreserve, runPostInstall } from './installer.js'

export async function handleReleaseCommand(
  cmd: ReleaseCommand,
  cfg: UpdaterConfig,
): Promise<void> {
  const installPath = resolveInstallPath(cfg, cmd.project)
  if (!installPath) {
    await report(cmd.release_id, 'FAILED', 'config', 0, {
      error: `本地未配置 ${cmd.project} 的 install_path`,
    })
    return
  }
  if (!cmd.tarball_url || !cmd.sha256) {
    await report(cmd.release_id, 'FAILED', 'config', 0, {
      error: '指令缺少 tarball_url 或 sha256',
    })
    return
  }

  const stagingDir = join(getUpdaterDir(), 'staging', cmd.release_id)
  const tarballPath = join(stagingDir, `${cmd.project}-${cmd.version}.tar.gz`)
  const active: ActiveRelease = {
    release_id: cmd.release_id,
    project: cmd.project,
    version: cmd.version,
    install_path: installPath,
    staging_dir: stagingDir,
    tarball_path: tarballPath,
    started_at: Date.now(),
  }
  saveState(active)
  await mkdir(stagingDir, { recursive: true })

  let backupDir: string | null = null
  try {
    await report(cmd.release_id, 'DOWNLOADING', 'download', 0)
    let lastReport = 0
    await downloadTarball({
      url: cmd.tarball_url,
      githubToken: cfg.github_token,
      savePath: tarballPath,
      onProgress: (d, t) => {
        const p = t > 0 ? Math.round((d / t) * 100) : 0
        if (Date.now() - lastReport > 3000) {
          lastReport = Date.now()
          report(cmd.release_id, 'DOWNLOADING', 'download', p).catch(() => {})
        }
      },
    })

    await report(cmd.release_id, 'VERIFYING', 'sha256', 50)
    const ok = await verifySha256(tarballPath, cmd.sha256)
    if (!ok) {
      throw new Error('sha256 校验失败, 文件可能损坏或被篡改')
    }
    await report(cmd.release_id, 'VERIFYING', 'sha256', 100)

    await report(cmd.release_id, 'BACKING_UP', 'backup', 0)
    backupDir = await backupInstallPath(installPath)
    active.backup_dir = backupDir ?? undefined
    saveState(active)
    pruneOldBackups(installPath)
    await report(cmd.release_id, 'BACKING_UP', 'backup', 100, {
      detail: { backup_dir: backupDir ?? '(首装, 无需备份)' },
    })

    await report(cmd.release_id, 'EXTRACTING', 'extract', 0)
    const { extractedDir, manifest } = await extractTarball(tarballPath, stagingDir)
    const preserve = manifest?.preserve ?? ['.env', '.env.*', 'logs/**', 'ops/state/**', 'node_modules']

    const findings = scanExtractedDir(extractedDir)
    if (findings.length > 0) {
      throw new Error(`二次密钥扫描发现 ${findings.length} 处疑似密钥, 拒绝安装`)
    }

    await mergeWithPreserve(extractedDir, installPath, preserve)
    await report(cmd.release_id, 'EXTRACTING', 'extract', 100)

    const postCmds = manifest?.post_install ?? []
    if (postCmds.length > 0) {
      await report(cmd.release_id, 'POST_INSTALL', 'post_install', 0)
      const result = await runPostInstall(installPath, postCmds, (line) => {
        console.log(`[post_install] ${line}`)
      })
      if (!result.ok) {
        throw new Error(`post_install 失败 (cmd: ${result.failedCmd}): ${result.error}`)
      }
      await report(cmd.release_id, 'POST_INSTALL', 'post_install', 100)
    }

    await report(cmd.release_id, 'SUCCESS', 'done', 100)
    await rm(stagingDir, { recursive: true, force: true })
    clearState()
  } catch (err) {
    const message = (err as Error).message
    console.error(`[handler] release ${cmd.release_id} failed:`, message)
    if (backupDir) {
      try {
        await restoreFromBackup(installPath, backupDir)
      } catch (rErr) {
        console.error('[handler] restoreFromBackup 失败:', rErr)
      }
    }
    await report(cmd.release_id, 'FAILED', 'rollback', 100, { error: message })
    try {
      await rm(stagingDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
    clearState()
  }
}
