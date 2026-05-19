/**
 * daemon 进度卡片渲染器
 *
 * 群里只发 1 条 interactive 卡片, daemon 每次进度调 message.patch 替换 content.
 * 卡片含: 项目名+版本 + 中文状态 + 进度条 + 隐藏的 meta 行 (供 bridge poller 解析).
 */

import type { ReleaseStatus } from '../types.js'

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '⏳',
  APPROVED: '✅',
  DOWNLOADING: '🟡',
  VERIFYING: '🟡',
  BACKING_UP: '🟡',
  EXTRACTING: '🟡',
  POST_INSTALL: '🟡',
  SUCCESS: '🟢',
  FAILED: '🔴',
  ROLLED_BACK: '⚪',
  SKIPPED: '⚪',
  TIMEOUT: '⚪',
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: '等待确认',
  APPROVED: '已同意',
  DOWNLOADING: '下载中',
  VERIFYING: '校验中',
  BACKING_UP: '备份中',
  EXTRACTING: '解压中',
  POST_INSTALL: '安装后处理',
  SUCCESS: '已成功更新',
  FAILED: '更新失败',
  ROLLED_BACK: '已回滚',
  SKIPPED: '已跳过',
  TIMEOUT: '已超时',
}

const STEP_TEXT: Record<string, string> = {
  download: '下载',
  sha256: '校验',
  backup: '备份',
  extract: '解压',
  post_install: '安装后处理',
  done: '完成',
  rollback: '回滚',
  config: '配置',
}

function templateOf(status: ReleaseStatus): string {
  if (status === 'SUCCESS') return 'green'
  if (status === 'FAILED') return 'red'
  if (status === 'PENDING' || status === 'APPROVED') return 'blue'
  return 'yellow'
}

function progressBar(p: number | undefined): string {
  const pct = Math.max(0, Math.min(100, p ?? 0))
  const filled = Math.round(pct / 10)
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${pct}%`
}

export interface ProgressCardInput {
  project: string
  version: string
  release_id: string
  status: ReleaseStatus
  step?: string
  progress?: number
  error?: string
}

/**
 * 构造 daemon 进度卡片 (interactive). 返回 JSON.stringify 后的 content, 直接喂 lark.im.message.create/patch.
 * 末尾 note 行嵌入机器可读 meta, 供 bridge poller 解析.
 */
export function buildProgressCard(input: ProgressCardInput): string {
  const emoji = STATUS_EMOJI[input.status] ?? '🟡'
  const statusText = STATUS_TEXT[input.status] ?? input.status
  const stepText = input.step ? STEP_TEXT[input.step] ?? input.step : ''
  const bar = progressBar(input.progress)

  const lines: string[] = [
    `**状态** ${emoji} ${statusText}${stepText ? ` (${stepText})` : ''}`,
    `**进度** ${bar}`,
  ]
  if (input.error) lines.push(`**错误** ${input.error}`)

  // Fix #4: 在 meta line 末尾追加 error=<URLEncoded>，让 bridge poller 能解析错误信息写 SQLite + 卡片显示
  const errPart = input.error ? ` error=${encodeURIComponent(input.error)}` : ''
  const metaLine = `release_id=${input.release_id} status=${input.status} step=${input.step ?? ''} progress=${input.progress ?? ''}${errPart}`

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `📦 ${input.project} ${input.version}` },
      template: templateOf(input.status),
    },
    elements: [
      { tag: 'markdown', content: lines.join('  \n') },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: metaLine }],
      },
    ],
  }
  return JSON.stringify(card)
}
