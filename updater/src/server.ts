/**
 * release-updater 主服务 (朋友 Mac 上 PM2 守护)
 */

import * as lark from '@larksuiteoapi/node-sdk'
import kleur from 'kleur'
import { loadConfig } from './lib/config.js'
import { initReporter } from './lib/reporter.js'
import { handleReleaseCommand } from './lib/handler.js'
import { loadState } from './lib/state.js'
import type { ReleaseCommand } from './types.js'

export async function startServer(): Promise<void> {
  console.log(kleur.bold().cyan('━━━ release-updater 启动中 ━━━'))

  const cfg = loadConfig()
  console.log(kleur.cyan('·'), `friend_id   = ${cfg.friend_id}`)
  console.log(kleur.cyan('·'), `app_id      = ${cfg.feishu_app_id}`)
  console.log(kleur.cyan('·'), `bridge_chat = ${cfg.bridge_chat_id}`)
  console.log(kleur.cyan('·'), `projects    = ${Object.keys(cfg.projects).join(', ') || '(空)'}`)

  initReporter(cfg)

  const prev = loadState()
  if (prev) {
    console.warn(kleur.yellow('!'), `检测到上次未完成的 release: ${prev.release_id}`)
    console.warn('  (v1.1 会自动恢复, 当前请手动清理 ~/.release-updater/state.json)')
  }

  const dispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data: unknown) => {
      try {
        await handleIncoming(data, cfg.friend_id)
      } catch (err) {
        console.error('[im.message.receive_v1] handler 异常:', err)
      }
    },
  })

  const wsClient = new lark.WSClient({
    appId: cfg.feishu_app_id,
    appSecret: cfg.feishu_app_secret,
    loggerLevel: lark.LoggerLevel.warn,
  })

  wsClient.start({ eventDispatcher: dispatcher })
  console.log(kleur.green('✓'), '飞书 WSClient 已启动')
  console.log('')
  console.log(kleur.bold().green('release-updater 运行中, 等待发版指令...'))

  process.on('SIGINT', () => { console.log('\n[SIGINT] 退出'); process.exit(0) })
  process.on('SIGTERM', () => { console.log('\n[SIGTERM] 退出'); process.exit(0) })
}

async function handleIncoming(data: unknown, friendId: string): Promise<void> {
  const ev = data as {
    sender?: { sender_id?: { open_id?: string } }
    message?: { content?: string; message_type?: string; chat_id?: string }
  }
  const content = ev.message?.content
  if (!content || ev.message?.message_type !== 'text') return

  let outer: { text?: string }
  try {
    outer = JSON.parse(content)
  } catch {
    return
  }
  if (!outer.text) return

  // bridge 给 daemon 发指令时会 @ daemon bot, 形如:
  // "<at user_id=\"ou_xxx\"></at> {json}". 解析前先剥离 @ 标签
  const stripped = outer.text.replace(/<at\b[^>]*>.*?<\/at>/g, '').trim()
  let cmd: ReleaseCommand
  try {
    cmd = JSON.parse(stripped)
  } catch {
    return
  }

  if (cmd.msg_type !== 'release_command') return
  console.log(kleur.cyan('▶'), `收到指令: ${cmd.project} ${cmd.version} (release_id=${cmd.release_id})`)

  const cfg = loadConfig()
  if (cfg.friend_id !== friendId) {
    console.warn(`[updater] friend_id 不匹配, 忽略`)
    return
  }

  await handleReleaseCommand(cmd, cfg)
}
