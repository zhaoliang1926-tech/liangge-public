/**
 * 主流程编排: 收到 release_command → 5 阶段执行 → 上报
 */
import type { ReleaseCommand, UpdaterConfig } from '../types.js';
export declare function handleReleaseCommand(cmd: ReleaseCommand, cfg: UpdaterConfig): Promise<void>;
//# sourceMappingURL=handler.d.ts.map