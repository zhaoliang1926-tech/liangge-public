/**
 * 飞书消息主动 poll (替代 WS 事件订阅)
 *
 * 背景: 飞书云端某些情况下不 push im.message.receive_v1 事件给 daemon WS,
 * 即使权限齐全/WS 长连接活着也收不到. 改用 API list 主动拉群消息.
 *
 * 流程: 每 POLL_INTERVAL_MS 调 im.v1.messages.list, 找新的 release_command, 调 handleReleaseCommand.
 */

import * as lark from '@larksuiteoapi/node-sdk'
import kleur from 'kleur'
import type { UpdaterConfig, ReleaseCommand } from '../types.js'
import { handleReleaseCommand } from './handler.js'

const POLL_INTERVAL_MS = 5_000
const PAGE_SIZE = 10
const DEDUP_MAX = 500

let _client: lark.Client | null = null
const _processed = new Set<string>()
let _startTimeSec = 0

function client(cfg: UpdaterConfig): lark.Client {
  if (!_client) {
    _client = new lark.Client({
      appId: cfg.feishu_app_id,
      appSecret: cfg.feishu_app_secret,
      disableTokenCache: false,
    })
  }
  return _client
}

function markProcessed(msgId: string): void {
  _processed.add(msgId)
  if (_processed.size > DEDUP_MAX) {
    const arr = Array.from(_processed)
    for (let i = 0; i < arr.length - DEDUP_MAX / 2; i++) {
      const old = arr[i]
      if (old !== undefined) _processed.delete(old)
    }
  }
}

async function pollOnce(cfg: UpdaterConfig): Promise<void> {
  try {
    const c = client(cfg)
    const res = await c.im.v1.message.list({
      params: {
        container_id_type: 'chat',
        container_id: cfg.bridge_chat_id,
        sort_type: 'ByCreateTimeDesc',
        page_size: PAGE_SIZE,
      },
    })
    if (res.code !== 0) {
      console.error('[poller] list 失败:', res.msg)
      return
    }
    const items = (res.data?.items ?? []) as Array<{
      message_id?: string
      msg_type?: string
      create_time?: string
      sender?: { id?: string; id_type?: string }
      body?: { content?: string }
    }>

    for (const m of items.slice().reverse()) {
      const msgId = m.message_id
      if (!msgId || _processed.has(msgId)) continue

      // interactive 卡片不靠 create_time 过滤 (bridge 可能在 daemon 启动后 patch 老卡片加 meta).
      // text 消息保留启动前过滤 (旧 raw JSON release_command 已废弃).
      if (m.msg_type === 'text') {
        const createTs = Number(m.create_time ?? 0)
        if (createTs && createTs < _startTimeSec * 1000) {
          markProcessed(msgId)
          continue
        }
      }

      const senderId = m.sender?.id
      if (senderId === cfg.feishu_app_id) {
        markProcessed(msgId)
        continue
      }

      let cmd: ReleaseCommand | null = null

      if (m.msg_type === 'text') {
        // 旧 path: bridge 发的 release_command text JSON (backward compat)
        let outer: { text?: string }
        try {
          outer = JSON.parse(m.body?.content ?? '{}')
        } catch {
          markProcessed(msgId)
          continue
        }
        if (!outer.text) {
          markProcessed(msgId)
          continue
        }
        const stripped = outer.text
          .replace(/<at\b[^>]*>.*?<\/at>/g, '')
          .replace(/@_user_\d+/g, '')
          .trim()
        try {
          cmd = JSON.parse(stripped) as ReleaseCommand
        } catch {
          markProcessed(msgId)
          continue
        }
      } else if (m.msg_type === 'interactive') {
        // L3 path: bridge 把 release_command 嵌入 APPROVED 卡片的 hidden note 行.
        // 关键: 同一 message_id 会经历 PENDING (无 meta) → 朋友点同意 → bridge patch 成 APPROVED (含 meta).
        // 所以 interactive 没匹配到 meta 时**不能 markProcessed**, 否则后续 patch 也被去重 skip.
        const rawContent = m.body?.content ?? ''
        // sha256 必须严格 64 hex (防止 \S+ 贪婪吞 JSON 尾部 "}]}]]} 之类)
        const matched = rawContent.match(
          /\[liangge-cmd\] approved=true release_id=(\S+) project=(\S+) version=(\S+) tarball_url=(\S+) sha256=([0-9a-fA-F]{64})/,
        )
        if (!matched) {
          continue // 不 markProcessed, 等下次 poll 再看是否 patch 上了 meta
        }
        cmd = {
          msg_type: 'release_command',
          release_id: matched[1] as string,
          project: matched[2] as string,
          version: matched[3] as string,
          tarball_url: matched[4],
          sha256: matched[5],
        }
      } else {
        markProcessed(msgId)
        continue
      }

      if (!cmd || cmd.msg_type !== 'release_command') {
        markProcessed(msgId)
        continue
      }

      console.log(
        kleur.cyan('▶'),
        `收到指令 (poll/${m.msg_type}): ${cmd.project} ${cmd.version} release_id=${cmd.release_id}`,
      )
      console.log(`   tarball_url=${cmd.tarball_url}`)
      console.log(`   sha256=${cmd.sha256}`)
      markProcessed(msgId)
      try {
        await handleReleaseCommand(cmd, cfg)
      } catch (err) {
        console.error('[poller] handler 异常:', err)
      }
    }
  } catch (err) {
    console.error('[poller] 异常:', (err as Error).message)
  }
}

export function startPoller(cfg: UpdaterConfig): void {
  _startTimeSec = Math.floor(Date.now() / 1000)
  console.log(
    kleur.green('✓'),
    `飞书消息 poller 已启动 (每 ${POLL_INTERVAL_MS / 1000}s 拉一次, 启动前消息忽略)`,
  )
  setInterval(() => {
    pollOnce(cfg).catch((err) => console.error('[poller] uncaught:', err))
  }, POLL_INTERVAL_MS)
  pollOnce(cfg).catch((err) => console.error('[poller] uncaught:', err))
}
