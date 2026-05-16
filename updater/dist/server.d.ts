/**
 * release-updater 主服务 (朋友 Mac 上 PM2 守护)
 *
 * 改造: 不再用 lark WSClient 订阅事件 (飞书云端 push 不可靠),
 * 改用 poller 主动调飞书 API list 群消息.
 */
export declare function startServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map