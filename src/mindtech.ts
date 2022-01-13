import {Client, ThreadChannel} from "discord.js";
import {Config} from "./types";
import {readFileSync, writeFileSync} from "fs";

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

const ACTION = [
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

let MEMBER_NAMES: Array<String> = []

const ANIMALS = [
    "Squirrel",
    "Dog",
    "Cheetah",
    "Wolf",
    "Meerkat",
    "Dragon",
    "Groundhog",
    "Leopard",
    "Protogen",
    "Snow Leopard",
    "Fox",
    "Crow",
    "Pink Tiger"
]

function randomMessage() {
    const randomMember = MEMBER_NAMES[Math.round(Math.random() * (MEMBER_NAMES.length - 1))];
    const randomAction = ACTION[Math.round(Math.random() * (ACTION.length - 1))];
    const randomAnimal = ANIMALS[Math.round(Math.random() * (ANIMALS.length - 1))];
    return `Furry ${randomAnimal} ${randomAction} ${randomMember}!`;
}

function initKeepAlive() {
    setInterval(async () => {
        readSave();
        for (const thread of threadsToKeepAlive) {
            if (thread.archived) {
                await thread.setArchived(true, "Keeping alive");
            }
            thread
                .send(randomMessage())
                .then((msg) => setTimeout(() => msg.delete(), 5000))
                .catch((e) => console.error(e));
        }
    }, 1000 * 60 * (23 * 60 + 55));
}

export default async (_client: Client, _config: Config) => {
    client = _client;
    config = _config;
    if (config.keepThreadsAlive) {
        client.on("messageCreate", async (message) => {
            if (
                message.channel instanceof ThreadChannel &&
                message.content.startsWith(config.prefix)
            ) {
                if (message.content.toLowerCase().match(/^=keepalive$/)) {
                    threadsToKeepAlive.add(message.channel);
                } else if (message.content.toLowerCase().match(/^=dontkeepalive$/)) {
                    threadsToKeepAlive.delete(message.channel);
                }
                writeSave();
                if (!message.deleted) {
                    message.delete().catch((e) => console.error(e));
                }
            }
        });
        initKeepAlive();
    }

    const GUILD_ID = "768718244244619315";
    const ROLE_ID = "776847666977832971";

    client.on("ready", async (client) => {
            const mt = client.guilds.cache.get(GUILD_ID)
            if (mt) {
                await mt.members.fetch();
                mt.roles.fetch(ROLE_ID).then(role => {
                    if (role == null) return;
                    role.members.forEach(member => {
                        console.log(member.displayName)
                        MEMBER_NAMES.push(member.displayName)
                    })
                })
            }
        }
    )
}
