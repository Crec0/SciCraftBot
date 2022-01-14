import { ThreadChannel } from "discord.js";
import { readFileSync, writeFileSync } from "fs";
let client;
let config;
let threadsToKeepAlive = new Set();
function writeSave() {
    const data = { threads: Array.from(threadsToKeepAlive) };
    writeFileSync("./threadsToKeepAlive.json", JSON.stringify(data, null, 4));
}
function readSave() {
    JSON
        .parse(readFileSync("./threadsToKeepAlive.json").toString())
        .threads
        .forEach((t) => threadsToKeepAlive.add(t));
}
export default async (_client, _config) => {
    client = _client;
    config = _config;
    if (config.keepThreadsAlive) {
        client.on("messageCreate", async (message) => {
            let content = message.content.toLowerCase();
            if (message.channel instanceof ThreadChannel && content.startsWith(config.prefix)) {
                content = content.slice(1);
                let shouldYeet = false;
                if (content.match(/^stayalive$/)) {
                    threadsToKeepAlive.add(message.channel.id);
                    shouldYeet = true;
                }
                else if (content.match(/^diepls$/)) {
                    threadsToKeepAlive.delete(message.channel.id);
                    shouldYeet = true;
                }
                writeSave();
                if (shouldYeet) {
                    message
                        .delete()
                        .catch((e) => console.error(e));
                }
            }
        });
        client.on("threadUpdate", async (prevThread, thread) => {
            var _a;
            readSave();
            if (!prevThread.archived && thread.archived && threadsToKeepAlive.has(thread.id)) {
                await thread.setArchived(false, "Keeping alive. smh.");
                await thread.setLocked((_a = prevThread.locked) !== null && _a !== void 0 ? _a : false, "Keeping alive. smh");
                thread.guild
                    .fetchAuditLogs({ type: "THREAD_UPDATE", limit: 4 })
                    .then(async (logs) => {
                    var _a, _b, _c;
                    for (const log of logs.entries.values()) {
                        if (!((_a = log.executor) === null || _a === void 0 ? void 0 : _a.bot)
                            && log.target.id == thread.id
                            && ((_b = log.changes) === null || _b === void 0 ? void 0 : _b.some(change => change.key === "archived" && change.new))) {
                            await thread.send(`<@${(_c = log.executor) === null || _c === void 0 ? void 0 : _c.id}> Thread is being kept alive. If you want to archive it, please run \`${_config.prefix}diePls\` before archiving.`);
                            break;
                        }
                    }
                });
            }
        });
    }
};
