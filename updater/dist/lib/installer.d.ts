/**
 * 解压 + 合并 + post_install
 */
export interface ExtractResult {
    extractedDir: string;
    manifest: ProjectManifest | null;
}
export interface ProjectManifest {
    project: string;
    install_path_default: string;
    preserve?: string[];
    post_install?: string[];
}
export declare function extractTarball(tarballPath: string, stagingDir: string): Promise<ExtractResult>;
export declare function mergeWithPreserve(extractedDir: string, installPath: string, preserve: string[]): Promise<void>;
export declare function runPostInstall(installPath: string, commands: string[], onLine: (line: string) => void): Promise<{
    ok: boolean;
    failedCmd?: string;
    error?: string;
}>;
//# sourceMappingURL=installer.d.ts.map