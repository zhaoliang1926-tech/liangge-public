/**
 * 状态持久化: ~/.release-updater/state.json
 */
import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getUpdaterDir } from './config.js';
function statePath() {
    return join(getUpdaterDir(), 'state.json');
}
export function saveState(state) {
    const path = statePath();
    mkdirSync(getUpdaterDir(), { recursive: true, mode: 0o700 });
    if (state === null) {
        if (existsSync(path))
            unlinkSync(path);
        return;
    }
    const tmp = `${path}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf-8', mode: 0o600 });
    renameSync(tmp, path);
}
export function loadState() {
    const path = statePath();
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
export function clearState() {
    saveState(null);
}
//# sourceMappingURL=state.js.map