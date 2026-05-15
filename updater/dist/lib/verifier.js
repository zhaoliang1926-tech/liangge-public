/**
 * 校验: sha256 + 二次密钥扫描 (L5 防护接收端兜底)
 */
import { createReadStream, readFileSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
export async function sha256OfFile(path) {
    const hash = createHash('sha256');
    await pipeline(createReadStream(path), hash);
    return hash.digest('hex');
}
export async function verifySha256(path, expected) {
    const got = await sha256OfFile(path);
    return got.toLowerCase() === expected.toLowerCase();
}
export const DEFAULT_SECRET_PATTERNS = [
    /sk-[a-zA-Z0-9]{32,}/,
    /sk-ant-[a-zA-Z0-9_-]{90,}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /github_pat_[a-zA-Z0-9_]{82}/,
    /pat_[a-zA-Z0-9]{40,}/,
    /t-g[a-zA-Z0-9_]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z_-]{35}/,
    /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
];
export function scanExtractedDir(dir, patterns = DEFAULT_SECRET_PATTERNS) {
    const findings = [];
    walk(dir, (file) => {
        try {
            const st = statSync(file);
            if (st.size > 5 * 1024 * 1024)
                return;
            if (!st.isFile())
                return;
            const content = readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                for (const re of patterns) {
                    if (re.test(lines[i])) {
                        findings.push({ file, line: i + 1, pattern: re.source });
                        break;
                    }
                }
            }
        }
        catch {
            // skip
        }
    });
    return findings;
}
function walk(dir, visit) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory())
            walk(p, visit);
        else
            visit(p);
    }
}
//# sourceMappingURL=verifier.js.map