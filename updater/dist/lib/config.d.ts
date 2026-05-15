/**
 * 朋友本地配置加载: ~/.release-updater/config.json
 */
import type { UpdaterConfig } from '../types.js';
export declare function getUpdaterDir(): string;
export declare function getConfigPath(): string;
export declare function loadConfig(): UpdaterConfig;
export declare function resolveInstallPath(cfg: UpdaterConfig, project: string): string | null;
//# sourceMappingURL=config.d.ts.map