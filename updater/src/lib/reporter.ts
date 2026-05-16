/**
 * 进度上报: updater → bridge (via 飞书 text 消息)
 */

import * as lark from '@larksuiteoapi/node-sdk'
import type { ProgressReport, ReleaseStatus, UpdaterConfig } from '../types.js'

let _client: lark.Client | null = null
let _cfg: UpdaterConfig | null = null

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

export async function report(
  releaseId: string,
  status: ReleaseStatus,
  step?: string,
  progress?: number,
  extra?: { error?: string; detail?: Record<string, unknown> },
): Promise<void> {
  const payload: ProgressReport = {
    msg_type: 'release_progress',
    release_id: releaseId,
    status,
    step,
    progress,
    error: extra?.error,
    detail: extra?.detail,
  }
  const content = JSON.stringify({ text: JSON.stringify(payload) })
  try {
    const res = await client().im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: cfg().bridge_chat_id,
        msg_type: 'text',
        content,
      },
    })
    if (res.code !== 0) {
      console.error(`[reporter] 上报失败: code=${res.code} msg=${res.msg}`)
    }
  } catch (err) {
    console.error('[reporter] 上报异常:', (err as Error).message)
  }
}
