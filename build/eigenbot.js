import { Embed, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, Message, MessageActionRow, } from "discord.js";
import { replyMessage, editMessage } from "./utils.js";
const PROJECTS = ["MC", "MCAPI", "MCCE", "MCD", "MCL", "MCPE", "REALMS", "BDS", "WEB"];
let client;
let config;
let jira;
const ITEMS_PER_PAGE = 15;
const activePaginators = new Map();
export default (_client, _config, _jira) => {
    client = _client;
    config = _config;
    jira = _jira;
    client.on("messageCreate", async (msg) => {
        try {
            await onMessage(msg);
        }
        catch (e) {
            console.error(e);
        }
    });
    client.on("interactionCreate", async (interaction) => {
        try {
            if (interaction instanceof CommandInteraction) {
                await onInteraction(interaction);
            }
        }
        catch (e) {
            console.error(e);
        }
    });
    return [
        new SlashCommandBuilder()
            .setName("upcoming")
            .setDescription("Shows bugs that are likely fixed in the next snapshot")
            .addStringOption((option) => option
            .setName("project")
            .setDescription('The project to search in, for example "MC"')),
        new SlashCommandBuilder().setName("mcstatus").setDescription("Checks Mojang server status"),
        new SlashCommandBuilder()
            .setName("bug")
            .setDescription("Shows information for a bug")
            .addStringOption((option) => option
            .setName("id")
            .setDescription("The bug id (for example MC-88959)")
            .setRequired(true)),
    ];
};
function onInteraction(interaction) {
    switch (interaction.commandName) {
        case "upcoming": {
            return sendUpcoming(interaction, interaction.options.getString("project"));
        }
        // case "mcstatus":
        //     return sendStatus(interaction);
        case "bug": {
            const key = interaction.options.getString("id");
            if (!key) {
                return;
            }
            const dash = key.indexOf("-");
            const bugNumber = key.substring(dash + 1);
            if (dash < 0 || parseInt(bugNumber).toString() !== bugNumber) {
                return replyMessage(interaction, "Invalid issue id");
            }
            if (!PROJECTS.includes(key.substring(0, dash).toUpperCase())) {
                return replyMessage(interaction, "Unknown project");
            }
            interaction.deferReply();
            return respondWithIssues(interaction, [key]);
        }
    }
}
async function onMessage(msg) {
    const escapedPrefix = config["prefix"].replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regexPattern = new RegExp(`${escapedPrefix}(${PROJECTS.join("|")})-[0-9]{1,7}`, "gi");
    const urlRegex = new RegExp(`https?://bugs.mojang.com/browse/(${PROJECTS.join("|")})-[0-9]{1,7}`, "gi");
    // We don't want our bot to react to other bots or itself
    if (msg.author.bot) {
        return;
    }
    // help: Gives usage information
    if (msg.content.startsWith(`${config["prefix"]}help`)) {
        await sendHelp(msg);
        return;
    }
    // upcoming: Checks for fixes in unreleased snapshots
    if (msg.content.startsWith(`${config["prefix"]}upcoming`)) {
        let project = "MC";
        const args = msg.content.split(" ");
        if (args.length > 1) {
            project = args[1].toUpperCase();
        }
        await sendUpcoming(msg, project);
        return;
    }
    // // mcstatus: Checks Mojang server status
    // if (msg.content.startsWith(`${config["prefix"]}mcstatus`)) {
    //     await sendStatus(msg);
    //     return;
    // }
    let matches = [];
    // Check for prefixed issue keys (!MC-1)
    const piks = msg.content.match(regexPattern);
    if (piks) {
        matches = piks.map((prefixedIssueKey) => prefixedIssueKey.slice(config["prefix"].length));
    }
    // Check for bugs.mojang.com urls
    const urls = msg.content.match(urlRegex);
    if (urls) {
        matches = matches.concat(urls.map((url) => url.split("/")[4]));
    }
    const keys = new Set(matches);
    if (!config["maxBugsPerMessage"] || keys.size <= config["maxBugsPerMessage"]) {
        await respondWithIssues(msg, Array.from(keys));
    }
}
async function fetchIssuesAndPaginate(message, issueKeys) {
    // makes a search querry
    // query is in form of 'issueKey in (key1, key2, key3, ...) ORDER BY issueKey ASC'
    const search = `issueKey in (${[...issueKeys].join(", ")}) ORDER BY issueKey ASC`;
    jira.searchJira(search)
        .then(async (results) => {
        if (!results.issues || !results.issues.length) {
            return editMessage(message, new Embed({ title: "No issues found", color: 0x00ff00 }));
        }
        createPaginator(message, "Issues", results.issues);
    })
        .catch((error) => {
        editMessage(message, new Embed({ title: "An error occured", color: 0xff0000 }));
        console.log("Error when processing upcoming command:");
        console.log(error);
    });
}
async function respondWithIssues(msg, issueKeys) {
    var _a;
    const maxIssuesBeforeBatching = (_a = config["maxIssuesBeforePagination"]) !== null && _a !== void 0 ? _a : 5;
    if (issueKeys.length > maxIssuesBeforeBatching) {
        replyMessage(msg, new Embed({ title: "Collecting issues" })).then((message) => {
            if (message instanceof Message) {
                fetchIssuesAndPaginate(message, issueKeys);
            }
        });
    }
    else {
        for (const issueKey of issueKeys) {
            await jira
                .findIssue(issueKey)
                .then((issue) => sendEmbed(msg, issue))
                .catch(async (error) => {
                if (error &&
                    error.error &&
                    error.error.errorMessages &&
                    error.error.errorMessages.includes("Issue Does Not Exist")) {
                    await editMessage(msg, `No issue was found for ${issueKey}.`);
                }
                else {
                    try {
                        await replyMessage(msg, "An unknown error has occurred.");
                    }
                    catch (_) {
                        /* Ignore */
                    }
                    console.log(error);
                }
            });
        }
    }
}
async function sendHelp(interaction) {
    const embed = new Embed({
        title: `${config["name"]} help`,
        description: `I listen for Minecraft bug report links or ${config["prefix"]}PROJECT-NUMBER\n` +
            `For example, saying https://bugs.mojang.com/browse/MC-81098 or ${config["prefix"]}MC-81098 will give quick info on those bugs`,
        fields: [
            {
                name: "Other commands: ",
                value: `**${config["prefix"]}help:** Shows this help screen.\n` +
                    `**${config["prefix"]}mcstatus:** Checks Mojang server status.\n` +
                    `**${config["prefix"]}upcoming:** Shows bugs that are likely fixed in the next snapshot.`,
            },
        ],
        url: config["url"],
        color: 9441545,
        footer: {
            text: config["name"],
        },
    });
    await replyMessage(interaction, embed);
}
function getPageToRender(message) {
    // get paginator from global cache
    const paginator = activePaginators.get(message.id);
    // calculate indices of items to render
    const start = (paginator.currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const rederableIssues = paginator.issues.slice(start, end);
    // map each issue to "issue key": "hyperlink issue title" style
    const description = rederableIssues
        .map((issue) => `\u300B[${issue.key}](https://bugs.mojang.com/browse/${issue.key}) - ${issue.fields.summary}`)
        .join("\n");
    const embed = {
        title: paginator.title,
        description,
        color: 0x7ed6df,
        footer: {
            text: `Page ${paginator.currentPage} of ${Math.ceil(paginator.issues.length / ITEMS_PER_PAGE)}`,
        },
    };
    const actionRow = new MessageActionRow().addComponents([
        {
            type: "BUTTON",
            customId: "previous",
            style: "SECONDARY",
            emoji: "\u2B05",
            disabled: paginator.currentPage === 1,
        },
        {
            type: "BUTTON",
            customId: "next",
            style: "SECONDARY",
            emoji: "\u27A1",
            disabled: paginator.currentPage === Math.ceil(paginator.issues.length / ITEMS_PER_PAGE),
        },
        {
            type: "BUTTON",
            customId: "done",
            style: "DANGER",
            emoji: "\uD83D\uDDD1",
        },
    ]);
    // return the baked page to send to dicord
    return {
        embeds: [embed],
        components: [actionRow],
    };
}
async function createPaginator(message, title, issues) {
    // add the issues to the global paginators
    activePaginators.set(message.id, { title, issues, currentPage: 1 });
    // do the first time render for page
    // since its not an interaction, an edit is ok
    message.edit(getPageToRender(message));
    // attach a collector to the message
    const colletor = message.createMessageComponentCollector({
        componentType: "BUTTON",
        time: 300000,
    });
    // when a button is clicked, handle it if it is a valid action
    colletor.on("collect", async (i) => {
        if (["previous", "next", "done"].includes(i.customId)) {
            handleButtonClick(i);
            colletor.resetTimer();
        }
    });
    // when the collector times out, remove buttons and remove it from global cache
    colletor.on("end", async () => {
        activePaginators.delete(message.id);
        message.edit({
            components: [],
        });
    });
}
async function sendUpcoming(interaction, _project) {
    // default to java edition if no project is specified
    const project = _project ? _project.toUpperCase() : "MC";
    // check if project is valid
    if (!PROJECTS.includes(project)) {
        replyMessage(interaction, new Embed({ title: "Invalid project", color: 0xff0000 }));
        return;
    }
    // send an placeholder embed while we fetch the issues
    interaction
        .reply({
        embeds: [{ title: `Checking for upcoming ${project} bugfixes...` }],
        fetchReply: true,
        allowedMentions: { repliedUser: false }
    })
        .then((message) => {
        if (!(message instanceof Message)) {
            return;
        }
        const search = `project = ${project} AND fixVersion in unreleasedVersions() ORDER BY resolved DESC`;
        jira.searchJira(search)
            .then(async (results) => {
            if (!results.issues || !results.issues.length) {
                return editMessage(message, new Embed({
                    title: "No upcoming bugfixes were found.",
                    color: 0x00ff00,
                }));
            }
            const bugCount = results.issues.length === 1
                ? "This 1 bug"
                : `These ${results.issues.length} bugs`;
            createPaginator(message, `${bugCount} will likely be fixed in the next update for ${project}`, results.issues);
            return message;
        })
            .catch((error) => {
            editMessage(message, new Embed({ title: "An error has occurred.", color: 0xff0000 }));
            console.log("Error when processing upcoming command:");
            console.log(error);
        });
    });
}
async function handleButtonClick(interaction) {
    const paginator = activePaginators.get(interaction.message.id);
    const totalPages = Math.ceil(paginator.issues.length / ITEMS_PER_PAGE);
    switch (interaction.customId) {
        case "previous":
            paginator.currentPage = Math.max(1, paginator.currentPage - 1);
            break;
        case "next":
            paginator.currentPage = Math.min(totalPages, paginator.currentPage + 1);
            break;
        case "done":
            activePaginators.delete(interaction.message.id);
            interaction.update({
                components: [],
            });
            return;
    }
    // update the message with the new page
    if (interaction.message instanceof Message) {
        interaction.message.edit(getPageToRender(interaction.message));
    }
}
// Send info about the bug in the form of an embed to the Discord channel
async function sendEmbed(interaction, issue) {
    const status = issue.fields.status.name;
    const voteCount = String(issue.fields.votes.votes);
    // Pick a color based on the status
    let color = config["colors"][status];
    let resolution = "Unresolved";
    if (issue.fields.resolution) {
        resolution = issue.fields.resolution.name;
        // modify the color based on the resolution
        if (["Invalid", "Duplicate", "Incomplete", "Cannot Reproduce"].includes(resolution)) {
            color = config["colors"].Invalid;
        }
        else if (["Won't Fix", "Works As Intended"].includes(resolution)) {
            color = config["colors"].Working;
        }
    }
    let categories = "Unassigned";
    if (issue.fields.customfield_11901) {
        categories = issue.fields.customfield_11901
            .map((category) => category.value)
            .join(", ");
    }
    let priority = "None";
    if (issue.fields.customfield_12200) {
        priority = issue.fields.customfield_12200.value;
    }
    let assignee = "Unassigned";
    if (issue.fields.assignee) {
        assignee = issue.fields.assignee.displayName;
    }
    const description = `\`\`\`
Status    : ${status}${" ".repeat(18 - status.length)}Resolution: ${resolution}
Votes     : ${voteCount}${" ".repeat(18 - voteCount.length)}Priority  : ${priority}
Category  : ${categories}
Reporter  : ${issue.fields.reporter.displayName}
Assignee  : ${assignee}
\`\`\``;
    const embed = new Embed({
        title: `${issue.key}: ${issue.fields.summary}`,
        url: `https://bugs.mojang.com/browse/${issue.key}`,
        description,
        color,
        timestamp: new Date(Date.parse(issue.fields.created)).toISOString(),
        footer: {
            text: "Created",
        },
    });
    await replyMessage(interaction, embed);
}
