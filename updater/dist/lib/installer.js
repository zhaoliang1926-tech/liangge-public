/**
 * 解压 + 合并 + post_install
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { extract as tarExtract } from 'tar';
import { execa } from 'execa';
export async function extractTarball(tarballPath, stagingDir) {
    const extractedDir = join(stagingDir, 'extracted');
    await mkdir(extractedDir, { recursive: true });
    await tarExtract({ file: tarballPath, cwd: extractedDir });
    const entries = readdirSync(extractedDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    let projectRoot = extractedDir;
    if (entries.length === 1) {
        projectRoot = join(extractedDir, entries[0].name);
    }
    let manifest = null;
    const manifestPath = join(projectRoot, '.release-manifest.json');
    if (existsSync(manifestPath)) {
        try {
            manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        }
        catch {
            // ignore
        }
    }
    return { extractedDir: projectRoot, manifest };
}
export async function mergeWithPreserve(extractedDir, installPath, preserve) {
    await mkdir(installPath, { recursive: true });
    const args = ['-a', '--delete'];
    for (const p of preserve) {
        args.push('--exclude', p);
    }
    args.push(`${extractedDir}/`, `${installPath}/`);
    await execa('rsync', args);
}
export async function runPostInstall(installPath, commands, onLine) {
    for (const cmd of commands) {
        onLine(`$ ${cmd}`);
        try {
            const sub = execa(cmd, { shell: true, cwd: installPath, all: true });
            if (sub.all) {
                sub.all.on('data', (b) => onLine(b.toString().trimEnd()));
            }
            await sub;
        }
        catch (err) {
            return { ok: false, failedCmd: cmd, error: err.message };
        }
    }
    return { ok: true };
}
//# sourceMappingURL=installer.js.map