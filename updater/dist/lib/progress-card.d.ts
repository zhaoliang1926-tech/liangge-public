/**
 * daemon 进度卡片渲染器
 *
 * 群里只发 1 条 interactive 卡片, daemon 每次进度调 message.patch 替换 content.
 * 卡片含: 项目名+版本 + 中文状态 + 进度条 + 隐藏的 meta 行 (供 bridge poller 解析).
 */
import type { ReleaseStatus } from '../types.js';
export interface ProgressCardInput {
    project: string;
    version: string;
    release_id: string;
    status: ReleaseStatus;
    step?: string;
    progress?: number;
    error?: string;
}
/**
 * 构造 daemon 进度卡片 (interactive). 返回 JSON.stringify 后的 content, 直接喂 lark.im.message.create/patch.
 * 末尾 note 行嵌入机器可读 meta, 供 bridge poller 解析.
 */
export declare function buildProgressCard(input: ProgressCardInput): string;
//# sourceMappingURL=progress-card.d.ts.map