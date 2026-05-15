/**
 * GitHub Release tarball 下载 (用朋友自己的 PAT)
 */
import { createWriteStream } from 'node:fs';
import { stat, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { request } from 'node:https';
import { URL } from 'node:url';
export async function downloadTarball(opts) {
    await mkdir(dirname(opts.savePath), { recursive: true });
    return new Promise((resolve, reject) => {
        fetchFollow(opts.url, opts.githubToken, opts.savePath, opts.onProgress, resolve, reject, 5);
    });
}
function fetchFollow(url, token, savePath, onProgress, resolve, reject, redirectsLeft) {
    const u = new URL(url);
    const req = request({
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
            Authorization: `token ${token}`,
            Accept: 'application/octet-stream',
            'User-Agent': 'liangge-updater',
        },
    }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectsLeft <= 0) {
                reject(new Error('重定向次数过多'));
                return;
            }
            fetchFollow(res.headers.location, token, savePath, onProgress, resolve, reject, redirectsLeft - 1);
            return;
        }
        if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} 下载失败`));
            return;
        }
        const total = Number(res.headers['content-length'] ?? 0);
        let downloaded = 0;
        const out = createWriteStream(savePath);
        res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (onProgress)
                onProgress(downloaded, total);
        });
        res.pipe(out);
        out.on('finish', () => {
            stat(savePath).then((st) => resolve({ size: st.size })).catch(reject);
        });
        out.on('error', reject);
        res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
}
//# sourceMappingURL=downloader.js.map