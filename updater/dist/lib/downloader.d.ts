/**
 * GitHub Release tarball 下载 (用朋友自己的 PAT)
 */
export interface DownloadOptions {
    url: string;
    githubToken: string;
    savePath: string;
    onProgress?: (downloaded: number, total: number) => void;
}
export declare function downloadTarball(opts: DownloadOptions): Promise<{
    size: number;
}>;
//# sourceMappingURL=downloader.d.ts.map