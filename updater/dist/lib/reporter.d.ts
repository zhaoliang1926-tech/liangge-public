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
import type { ReleaseCommand, ReleaseStatus, UpdaterConfig } from '../types.js';
export declare function initReporter(cfg: UpdaterConfig): void;
/** handler 进入 handleReleaseCommand 时调一次, 把 project/version 暴露给 reporter */
export declare function setActiveCmd(cmd: ReleaseCommand): void;
export declare function report(releaseId: string, status: ReleaseStatus, step?: string, progress?: number, extra?: {
    error?: string;
    detail?: Record<string, unknown>;
}): Promise<void>;
/**
 * daemon 启动时发一张欢迎卡片到群, 让发版方知道朋友 daemon 已上线.
 * 失败不阻塞 daemon 启动.
 */
export declare function sendBootCard(): Promise<void>;
//# sourceMappingURL=reporter.d.ts.map