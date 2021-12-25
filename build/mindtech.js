import { ThreadChannel } from "discord.js";
import { writeFileSync, readFileSync } from "fs";
let client;
let config;
let threadsToKeepAlive = new Set();
function writeSave() {
    const data = {
        threads: Array.from(threadsToKeepAlive).map((thread) => thread.id),
    };
    writeFileSync("./threadsToKeepAlive.json", JSON.stringify(data, null, 4));
}
function readSave() {
    const data = JSON.parse(readFileSync("./threadsToKeepAlive.json").toString());
    for (const id of data.threads) {
        const channel = client.channels.cache.get(id);
        if (channel) {
            threadsToKeepAlive.add(channel);
        }
    }
}
function randomMessage() {
    let array = [
        "grins and licks",
        "flops and licks",
        "gets up and licks",
        "happily licks",
        "submissively licks",
        "smooches and licks",
        "pushed over and licked",
        "happily kisses",
        "blushes and then kisses",
        "surprise-kisses",
        "hastily kisses",
        "sneakily kisses",
        "noms",
        "started to nom on",
        "noms and licks",
        "happily hugs",
        "giggles and hugs",
        "sneaks up out of nowhere and hugs",
        "tackle-hugs",
    ];
    return `Furry sperm whale ${array[Math.round(Math.random() * (array.length - 1))]} Pfeffa!`;
}
function initKeepAlive() {
    setInterval(() => {
        readSave();
        for (const thread of threadsToKeepAlive) {
            if (thread.archived) {
                thread.setArchived(true, "Keeping alive");
            }
            thread
                .send(randomMessage())
                .then((msg) => setTimeout(() => msg.delete(), 1000))
                .catch((e) => console.error(e));
        }
    }, 1000 * 60 * 60);
}
export default async (_client, _config) => {
    client = _client;
    config = _config;
    if (config.keepThreadsAlive) {
        client.on("messageCreate", async (message) => {
            if (message.channel instanceof ThreadChannel &&
                message.content.startsWith(config.prefix)) {
                if (message.content.toLowerCase().match(/^=keepalive$/)) {
                    threadsToKeepAlive.add(message.channel);
                }
                else if (message.content.toLowerCase().match(/^=dontkeepalive$/)) {
                    threadsToKeepAlive.delete(message.channel);
                }
                writeSave();
                message.delete().catch((e) => console.error(e));
            }
        });
        readSave();
        initKeepAlive();
    }
};
