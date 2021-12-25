import { Client, ThreadChannel } from "discord.js";
import { Config } from "./types";
import { writeFileSync, readFileSync } from "fs";

let client: Client;
let config: Config;
let threadsToKeepAlive: Set<ThreadChannel> = new Set();

function writeSave() {
    const data = {
        threads: Array.from(threadsToKeepAlive).map((thread) => thread.id),
    };
    writeFileSync("./threadsToKeepAlive.json", JSON.stringify(data, null, 4));
}

function readSave() {
    const data = JSON.parse(readFileSync("./threadsToKeepAlive.json").toString());
    for (const id of data.threads) {
        const channel = client.channels.cache.get(id) as ThreadChannel;
        if (channel) {
            threadsToKeepAlive.add(channel);
        }
    }
}

function initKeepAlive() {
    setInterval(() => {
        readSave();
        for (const thread of threadsToKeepAlive) {
            thread
                .send(":middle_finger: pheha")
                .then((msg) => setTimeout(() => msg.delete(), 1000))
                .catch(() => {});
        }
    }, 1000 * 60 * 60);
}

export default async (_client: Client, _config: Config) => {
    client = _client;
    config = _config;
    if (config.keepThreadsAlive) {
        client.on("messageCreate", async (message) => {
            if (
                message.channel instanceof ThreadChannel &&
                message.content.startsWith(config.prefix) &&
                message.content.toLowerCase().match(/^=keepalive$/)
            ) {
                threadsToKeepAlive.add(message.channel);
                writeSave();
                message.delete().catch(() => {});
            }
        });
        readSave();
        initKeepAlive();
    }
};
