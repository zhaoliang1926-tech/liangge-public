/**
 * 校验: sha256 + 二次密钥扫描 (L5 防护接收端兜底)
 */
export declare function sha256OfFile(path: string): Promise<string>;
export declare function verifySha256(path: string, expected: string): Promise<boolean>;
export declare const DEFAULT_SECRET_PATTERNS: RegExp[];
export interface Finding {
    file: string;
    line: number;
    pattern: string;
}
export declare function scanExtractedDir(dir: string, patterns?: RegExp[]): Finding[];
//# sourceMappingURL=verifier.d.ts.map