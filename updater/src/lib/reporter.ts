/**
 * 进度上报: updater → bridge.
 *
 * 设计: 每次 release 群里只发 1 张 daemon 卡片, daemon 自己 patch 这张卡刷新进度.
 * bridge poller 通过 list 消息 + 解析卡片 note 行的 meta 拿到 status.
 *
 * 流程:
 *   1. handler 开始时调 setActiveCmd(cmd) 让 reporter 拿到 project/version
 *   2. handler 每个阶段调 report(status, step, progress)
 *   3. 第一次 report → create card → 缓存 message_id
 *   4. 后续 report → patch 同一 message_id
 *   5. 终态 (SUCCESS/FAILED/ROLLED_BACK) 后清缓存
 */

import * as lark from '@larksuiteoapi/node-sdk'
import type { ReleaseCommand, ReleaseStatus, UpdaterConfig } from '../types.js'
import { buildProgressCard } from './progress-card.js'

let _client: lark.Client | null = null
let _cfg: UpdaterConfig | null = null

interface ActiveRelease {
  release_id: string
  project: string
  version: string
  message_id: string | null
}
let _active: ActiveRelease | null = null

export function initReporter(cfg: UpdaterConfig): void {
  _cfg = cfg
  _client = new lark.Client({
    appId: cfg.feishu_app_id,
    appSecret: cfg.feishu_app_secret,
    disableTokenCache: false,
  })
}

function client(): lark.Client {
  if (!_client) throw new Error('reporter 未初始化')
  return _client
}

function cfg(): UpdaterConfig {
  if (!_cfg) throw new Error('reporter 未初始化')
  return _cfg
}

/** handler 进入 handleReleaseCommand 时调一次, 把 project/version 暴露给 reporter */
export function setActiveCmd(cmd: ReleaseCommand): void {
  _active = {
    release_id: cmd.release_id,
    project: cmd.project,
    version: cmd.version,
    message_id: null,
  }
}

function isFinal(status: ReleaseStatus): boolean {
  return ['SUCCESS', 'FAILED', 'SKIPPED', 'TIMEOUT'].includes(status)
}

export async function report(
  releaseId: string,
  status: ReleaseStatus,
  step?: string,
  progress?: number,
  extra?: { error?: string; detail?: Record<string, unknown> },
): Promise<void> {
  if (!_active || _active.release_id !== releaseId) {
    console.warn(`[reporter] activeRelease 不匹配 release_id=${releaseId}, 跳过上报`)
    return
  }
  const content = buildProgressCard({
    project: _active.project,
    version: _active.version,
    release_id: releaseId,
    status,
    step,
    progress,
    error: extra?.error,
  })

  try {
    if (!_active.message_id) {
      const res = await client().im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: cfg().bridge_chat_id,
          msg_type: 'interactive',
          content,
        },
      })
      if (res.code !== 0) {
        console.error(`[reporter] create card 失败: code=${res.code} msg=${res.msg}`)
        return
      }
      _active.message_id = res.data?.message_id ?? null
    } else {
      const res = await client().im.message.patch({
        path: { message_id: _active.message_id },
        data: { content },
      })
      if (res.code !== 0) {
        console.error(`[reporter] patch card 失败: code=${res.code} msg=${res.msg}`)
      }
    }
  } catch (err) {
    console.error('[reporter] 上报异常:', (err as Error).message)
  }

  if (isFinal(status)) {
    _active = null
  }
}

/**
 * daemon 启动时发一张欢迎卡片到群, 让发版方知道朋友 daemon 已上线.
 * 失败不阻塞 daemon 启动.
 */
export async function sendBootCard(): Promise<void> {
  if (!_client || !_cfg) return
  const friendDisplay = _cfg.friend_name ?? _cfg.friend_id
  const projects = Object.keys(_cfg.projects).join(', ') || '(暂无订阅)'
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🎉 ${friendDisplay} 的 daemon 已上线` },
      template: 'green',
    },
    elements: [
      {
        tag: 'markdown',
        content: `**订阅项目** ${projects}\n**状态** 等待发版指令 (poll 模式, 每 5s 拉一次)`,
      },
    ],
  }
  try {
    const res = await _client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: _cfg.bridge_chat_id,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    })
    if (res.code !== 0) {
      console.error(`[boot-card] 发卡片失败: code=${res.code} msg=${res.msg}`)
    }
  } catch (err) {
    console.error('[boot-card] 异常:', (err as Error).message)
  }
}
