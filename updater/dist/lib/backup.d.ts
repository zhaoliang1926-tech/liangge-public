/**
 * 备份当前 install_path → install_path.bak-<ts>/
 * 保留最近 7 天，老的自动清理
 */
export declare function backupInstallPath(installPath: string): Promise<string | null>;
export declare function restoreFromBackup(installPath: string, backupPath: string): Promise<void>;
export declare function pruneOldBackups(installPath: string): string[];
//# sourceMappingURL=backup.d.ts.map