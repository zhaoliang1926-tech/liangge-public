/**
 * release-updater 主服务 (朋友 Mac 上 PM2 守护)
 *
 * 改造: 不再用 lark WSClient 订阅事件 (飞书云端 push 不可靠),
 * 改用 poller 主动调飞书 API list 群消息.
 */
import kleur from 'kleur';
import { loadConfig } from './lib/config.js';
import { initReporter, sendBootCard } from './lib/reporter.js';
import { loadState } from './lib/state.js';
import { startPoller } from './lib/poller.js';
export async function startServer() {
    console.log(kleur.bold().cyan('━━━ release-updater 启动中 ━━━'));
    const cfg = loadConfig();
    console.log(kleur.cyan('·'), `friend_id   = ${cfg.friend_id}`);
    console.log(kleur.cyan('·'), `app_id      = ${cfg.feishu_app_id}`);
    console.log(kleur.cyan('·'), `bridge_chat = ${cfg.bridge_chat_id}`);
    console.log(kleur.cyan('·'), `projects    = ${Object.keys(cfg.projects).join(', ') || '(空)'}`);
    initReporter(cfg);
    const prev = loadState();
    if (prev) {
        console.warn(kleur.yellow('!'), `检测到上次未完成的 release: ${prev.release_id}`);
        console.warn('  (v1.1 会自动恢复, 当前请手动清理 ~/.release-updater/state.json)');
    }
    startPoller(cfg);
    console.log('');
    console.log(kleur.bold().green('release-updater 运行中, 等待发版指令 (主动 poll 模式)...'));
    // 给群发欢迎卡片 (fire-and-forget, 失败不阻塞)
    sendBootCard().catch((err) => console.error('[boot] 发欢迎卡片异常:', err));
    process.on('SIGINT', () => { console.log('\n[SIGINT] 退出'); process.exit(0); });
    process.on('SIGTERM', () => { console.log('\n[SIGTERM] 退出'); process.exit(0); });
}
//# sourceMappingURL=server.js.map