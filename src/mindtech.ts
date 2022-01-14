import {Client, ThreadChannel} from "discord.js";
import {Config} from "./types";
import {readFileSync, writeFileSync} from "fs";

let client: Client;
let config: Config;
let threadsToKeepAlive: Set<String> = new Set();

function writeSave() {
    const data = {threads: Array.from(threadsToKeepAlive)};
    writeFileSync("./threadsToKeepAlive.json", JSON.stringify(data, null, 4));
}

function readSave() {
    JSON
        .parse(readFileSync("./threadsToKeepAlive.json").toString())
        .threads
        .forEach((t: String) => threadsToKeepAlive.add(t))
}

export default async (_client: Client, _config: Config) => {
    client = _client;
    config = _config;
    if (config.keepThreadsAlive) {
        client.on("messageCreate", async (message) => {
            let content = message.content.toLowerCase();
            if (message.channel instanceof ThreadChannel && content.startsWith(config.prefix)) {
                content = content.slice(1)
                let shouldYeet = false;
                if (content.match(/^stayalive$/)) {
                    threadsToKeepAlive.add(message.channel.id);
                    shouldYeet = true;
                } else if (content.match(/^diepls$/)) {
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
            readSave();
            if (!prevThread.archived && thread.archived && threadsToKeepAlive.has(thread.id)) {
                await thread.setArchived(false, "Keeping alive. smh.")
                await thread.setLocked(prevThread.locked ?? false, "Keeping alive. smh")
                thread.guild
                    .fetchAuditLogs({type: "THREAD_UPDATE", limit: 4})
                    .then(async (logs) => {
                        for (const log of logs.entries.values()) {
                            if (!log.executor?.bot
                                && (log.target as ThreadChannel).id == thread.id
                                && log.changes?.some(change => change.key === "archived" && change.new)
                            ) {
                                await thread.send(`<@${log.executor?.id}> Thread is being kept alive. If you want to archive it, please run \`${_config.prefix}diePls\` before archiving.`)
                                break;
                            }
                        }
                    })
            }
        });
    }
}
