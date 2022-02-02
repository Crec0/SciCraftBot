import { CommandInteraction, Formatters, MessageEmbed, ThreadChannel } from "discord.js";
import { readFileSync, writeFileSync } from "fs";
import { SlashCommandBuilder } from "@discordjs/builders";
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
async function fetchAllMessages(channel) {
    var _a;
    let messages = [];
    let lastID = (_a = channel.lastMessage) === null || _a === void 0 ? void 0 : _a.id;
    while (true) {
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            before: lastID,
        });
        if (fetchedMessages.size === 0) {
            return messages;
        }
        messages = messages.concat(Array.from(fetchedMessages.values()).filter(message => !message.author.bot && message.content.match(/\b\d+\b/)));
        console.log(messages.length);
        lastID = fetchedMessages.lastKey();
    }
}
async function channelStats(channel) {
    let stats = new Map();
    const messages = await fetchAllMessages(channel);
    for (const message of messages) {
        const author = message.author.id;
        stats.set(author, stats.has(author) ? stats.get(author) + 1 : 1);
    }
    return new Map([...stats.entries()].sort(([, a], [, b]) => a < b ? 1 : -1).slice(0, 25));
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
    client.on("interactionCreate", async (interaction) => {
        var _a;
        if (interaction instanceof CommandInteraction) {
            switch (interaction.commandName) {
                case "count_messages":
                    await interaction.deferReply();
                    if (((_a = interaction.memberPermissions) === null || _a === void 0 ? void 0 : _a.has("ADMINISTRATOR")) && interaction.channel) {
                        const stats = await channelStats(interaction.channel);
                        let desc = "";
                        for (const [id, count] of stats) {
                            desc += `${Formatters.userMention(id)} : ${count}\n`;
                        }
                        const embed = new MessageEmbed()
                            .setTitle("Channel Messages Sent Leaderboard")
                            .setDescription(desc)
                            .setFooter(`Requested by ${interaction.user.tag}`);
                        await interaction.editReply({
                            embeds: [embed]
                        });
                    }
                    else {
                        interaction
                            .reply({
                            ephemeral: true,
                            content: "Command can only be ran in a text channel and user must have administrator permissions"
                        })
                            .then(() => {
                        })
                            .catch(err => console.error(err));
                    }
                    break;
            }
        }
    });
    return [
        new SlashCommandBuilder()
            .setName("count_messages")
            .setDescription("counts the messages per user in the channel")
    ];
};
