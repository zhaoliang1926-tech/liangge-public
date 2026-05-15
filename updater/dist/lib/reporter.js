/**
 * 进度上报: updater → bridge (via 飞书 text 消息)
 */
import * as lark from '@larksuiteoapi/node-sdk';
let _client = null;
let _cfg = null;
export function initReporter(cfg) {
    _cfg = cfg;
    _client = new lark.Client({
        appId: cfg.feishu_app_id,
        appSecret: cfg.feishu_app_secret,
        disableTokenCache: false,
    });
}
function client() {
    if (!_client)
        throw new Error('reporter 未初始化');
    return _client;
}
function cfg() {
    if (!_cfg)
        throw new Error('reporter 未初始化');
    return _cfg;
}
export async function report(releaseId, status, step, progress, extra) {
    const payload = {
        msg_type: 'release_progress',
        release_id: releaseId,
        status,
        step,
        progress,
        error: extra?.error,
        detail: extra?.detail,
    };
    const content = JSON.stringify({ text: JSON.stringify(payload) });
    try {
        const res = await client().im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: {
                receive_id: cfg().bridge_chat_id,
                msg_type: 'text',
                content,
            },
        });
        if (res.code !== 0) {
            console.error(`[reporter] 上报失败: code=${res.code} msg=${res.msg}`);
        }
    }
    catch (err) {
        console.error('[reporter] 上报异常:', err.message);
    }
}
//# sourceMappingURL=reporter.js.map