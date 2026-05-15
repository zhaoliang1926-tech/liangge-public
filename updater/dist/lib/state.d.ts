/**
 * 状态持久化: ~/.release-updater/state.json
 */
import type { ActiveRelease } from '../types.js';
export declare function saveState(state: ActiveRelease | null): void;
export declare function loadState(): ActiveRelease | null;
export declare function clearState(): void;
//# sourceMappingURL=state.d.ts.map