/**
 * 飞书消息主动 poll (替代 WS 事件订阅)
 *
 * 背景: 飞书云端某些情况下不 push im.message.receive_v1 事件给 daemon WS,
 * 即使权限齐全/WS 长连接活着也收不到. 改用 API list 主动拉群消息.
 *
 * 流程: 每 POLL_INTERVAL_MS 调 im.v1.messages.list, 找新的 release_command, 调 handleReleaseCommand.
 */
import type { UpdaterConfig } from '../types.js';
export declare function startPoller(cfg: UpdaterConfig): void;
//# sourceMappingURL=poller.d.ts.map