/**
 * 进度上报: updater → bridge (via 飞书 text 消息)
 */
import type { ReleaseStatus, UpdaterConfig } from '../types.js';
export declare function initReporter(cfg: UpdaterConfig): void;
export declare function report(releaseId: string, status: ReleaseStatus, step?: string, progress?: number, extra?: {
    error?: string;
    detail?: Record<string, unknown>;
}): Promise<void>;
//# sourceMappingURL=reporter.d.ts.map