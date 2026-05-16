/**
 * release-updater 共享类型
 */

export type ReleaseStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'BACKING_UP'
  | 'EXTRACTING'
  | 'POST_INSTALL'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'
  | 'TIMEOUT'

export interface ProjectConfig {
  install_path: string
}

export interface UpdaterConfig {
  friend_id: string
  friend_name?: string
  feishu_app_id: string
  feishu_app_secret: string
  updater_token: string
  github_token: string
  bridge_chat_id: string
  projects: Record<string, ProjectConfig>
}

export interface ReleaseCommand {
  msg_type: 'release_command' | 'rollback_command' | 'revoke_command'
  release_id: string
  project: string
  version: string
  tarball_url?: string
  sha256?: string
  bridge_msg_id?: string
}

export interface ProgressReport {
  msg_type: 'release_progress'
  release_id: string
  status: ReleaseStatus
  step?: string
  progress?: number
  error?: string
  detail?: Record<string, unknown>
}

export interface ActiveRelease {
  release_id: string
  project: string
  version: string
  install_path: string
  staging_dir: string
  backup_dir?: string
  tarball_path?: string
  started_at: number
}
