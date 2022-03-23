import {
    Client,
    CommandInteraction, Formatters, Message, MessageEmbed,
    TextBasedChannels,
    ThreadChannel
} from "discord.js";
import {Config} from "./types";
import {readFileSync, writeFileSync} from "fs";
import {SlashCommandBuilder} from "@discordjs/builders";

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

async function fetchAllMessages(channel: TextBasedChannels) {
    let messages: Message[] = [];
    let lastID: string | undefined = channel.lastMessage?.id;

    while (true) {
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            before: lastID,
        });

        if (fetchedMessages.size === 0) {
            return messages;
        }

        messages = messages.concat(Array.from(fetchedMessages.values()).filter(message => !message.author.bot));
        console.log(messages.length);
        lastID = fetchedMessages.lastKey();
    }
}

async function channelStats(channel: TextBasedChannels) {
    let stats: Map<string, number> = new Map<string, number>();
    const messages = await fetchAllMessages(channel);
    for (const message of messages) {
        const author = message.author.id;
        stats.set(author, stats.has(author) ? (stats.get(author) as number) + 1 : 1);
    }
    return new Map([...stats.entries()].sort(([, a], [, b]) => a < b ? 1 : -1).slice(0, 25));
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

    client.on("interactionCreate", async (interaction) => {
        if (interaction instanceof CommandInteraction) {
            switch (interaction.commandName) {
            case "count_messages":
                await interaction.deferReply()
                if (interaction.memberPermissions?.has("ADMINISTRATOR") && interaction.channel) {
                    const stats = await channelStats(interaction.channel);
                    let desc = "";
                    for (const [id, count] of stats) {
                        desc += `${Formatters.userMention(id)} : ${count}\n`
                    }
                    const embed = new MessageEmbed()
                        .setTitle("Channel Messages Sent Leaderboard")
                        .setDescription(desc)
                        .setFooter(`Requested by ${interaction.user.tag}`)

                    await interaction.editReply({
                        embeds: [embed]
                    })
                } else {
                    interaction
                        .reply({
                            ephemeral: true,
                            content: "Command can only be ran in a text channel and user must have administrator permissions"
                        })
                        .then(() => {
                        })
                        .catch(err => console.error(err))
                }
                break
            }
        }
    });

    return [
        new SlashCommandBuilder()
            .setName("count_messages")
            .setDescription("counts the messages per user in the channel")
    ]
}
