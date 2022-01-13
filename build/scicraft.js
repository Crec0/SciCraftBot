import { Embed } from "@discordjs/builders";
import request from "request";
let client;
let config;
const twitchAuth = {
    id: "",
    secret: "",
};
const streamMessages = new Set();
function initCleanupStreamsChannels() {
    const cleanupConf = config.cleanupStreams;
    if (!cleanupConf)
        return;
    const channels = cleanupConf.channels || [];
    client.on("messageCreate", (msg) => {
        if (channels.includes(msg.channel.id))
            checkCleanup(msg);
    });
    if (cleanupConf.twitchApiClientID && cleanupConf.twitchApiClientSecret) {
        twitchAuth.id = cleanupConf.twitchApiClientID;
        twitchAuth.secret = cleanupConf.twitchApiClientSecret;
        setInterval(async () => {
            try {
                await checkStreams(cleanupConf.gracePeriod || 10 * 60);
            }
            catch (e) {
                console.error(e);
            }
        }, 30e3);
    }
}
function initMoniterLinksOnlyChannels() {
    const linkOnlyConf = config.linksOnly;
    if (!linkOnlyConf)
        return;
    const ignoreRoles = linkOnlyConf.ignoreRoles || [];
    const ignorePermissions = linkOnlyConf.ignorePermissions || ["MANAGE_CHANNELS"];
    const channels = linkOnlyConf.channels || [];
    const allowedLinks = [
        /\bhttps:\/\/youtu\.be\//,
        /\bhttps:\/\/www\.youtube\.com\//,
        /\bhttps:\/\/www\.m\.youtube\.com\//,
        /\bhttps:\/\/www\.twitch\.tv\//,
        /\bhttps:\/\/www\.bilibili\.com\/video\//,
        /\bhttps:\/\/www\.b23\.tv\//
    ];
    client.on("messageCreate", (msg) => {
        if (msg.author.bot ||
            !channels.includes(msg.channel.id) ||
            !msg.deletable ||
            !msg.member ||
            allowedLinks.some((link) => link.test(msg.content)) ||
            msg.embeds.some((e) => e.video)) {
            return;
        }
        for (const [id, role] of msg.member.roles.cache) {
            if (ignoreRoles.includes(id)) {
                console.log(`${msg.id}: ${msg.author.username} has ${role.name}, not deleting`);
                return;
            }
        }
        for (const perm of ignorePermissions) {
            if (msg.member.permissions.has(perm)) {
                console.log(`${msg.id}: ${msg.author.username} has ${perm}, not deleting`);
                return;
            }
        }
        deleteAndLog(msg, "Text message in links-only channel");
    });
}
function initMonitorMediaOnlyChannels() {
    const mediaOnlyConf = config.mediaOnly;
    if (!mediaOnlyConf)
        return;
    const ignoreRoles = mediaOnlyConf.ignoreRoles || [];
    const ignorePermissions = mediaOnlyConf.ignorePermissions || ["MANAGE_CHANNELS"];
    const channels = mediaOnlyConf.channels || [];
    client.on("messageCreate", (msg) => {
        if (msg.author.bot ||
            !channels.includes(msg.channel.id) ||
            !msg.deletable ||
            !msg.member ||
            /\bhttp(s)?:\/\//.test(msg.content) ||
            msg.embeds.length)
            return;
        for (const [id, role] of msg.member.roles.cache) {
            if (ignoreRoles.includes(id)) {
                console.log(`${msg.id}: ${msg.author.username} has ${role.name}, not deleting`);
                return;
            }
        }
        for (const perm of ignorePermissions) {
            if (msg.member.permissions.has(perm)) {
                console.log(`${msg.id}: ${msg.author.username} has ${perm}, not deleting`);
                return;
            }
        }
        if (msg.attachments.size == 0) {
            deleteAndLog(msg, "Text message in media-only channel");
            return;
        }
        const img = msg.attachments.values().next().value.name.toLowerCase();
        console.log(img);
        if (img.startsWith("screen_shot")) {
            deleteAndLog(msg, "KEKW");
        }
    });
}
function checkCleanup(msg) {
    if (!msg.deletable || !/\btwitch\.tv\//.test(msg.content))
        return;
    const match = msg.content.match(/\b(clips\.)?twitch\.tv\/(.+?)\b/);
    if (!match || match[1])
        return;
    if (match[2] === "videos")
        return; // Highlights & VODs
    console.log(`Picked up message ${msg.id} linking to ${match[0]} (user ${match[2]})`);
    streamMessages.add({
        message: msg,
        twitchUser: match[2],
    });
}
async function checkStreams(gracePeriod) {
    const users = [...new Set([...streamMessages].map((m) => m.twitchUser))];
    if (!users.length)
        return;
    const streams = await getTwitchApi("streams", {
        first: 100,
        user_login: users,
    });
    const online = streams
        .filter((s) => s.type === "live")
        .map((s) => s.user_name.toLowerCase());
    for (const msg of streamMessages) {
        if (online.includes(msg.twitchUser.toLowerCase()))
            continue;
        if (Date.now() - msg.message.createdTimestamp < gracePeriod * 1000) {
            if (!msg.loggedGrace) {
                console.log(`${msg.message.id} is in grace period`);
                msg.loggedGrace = true;
            }
            continue;
        }
        try {
            await deleteAndLog(msg.message, "Stream offline");
        }
        catch (e) {
            console.error(`Could not delete message ${msg.message.id}`);
            console.error(e);
        }
        streamMessages.delete(msg);
    }
}
async function log(msg, reason) {
    if (config["modlog"]) {
        const modlog = await client.channels.fetch(config.modlog);
        const embed = new Embed({
            author: { name: msg.author.tag, icon_url: msg.author.displayAvatarURL() },
            description: `**Message by <@${msg.author.id}> deleted in <#${msg.channel.id}>**\n${msg.content}`,
            fields: [{ name: "Reason", value: reason }],
            footer: { text: `ID: ${msg.id}` },
            timestamp: new Date(msg.createdTimestamp).toISOString(),
        });
        await modlog.send({ embeds: [embed] });
    }
}
async function deleteAndLog(msg, reason) {
    msg.delete()
        .then(() => log(msg, reason))
        .catch(() => {
    });
}
let oauthToken;
let oauthExpires;
async function getTwitchOauthToken() {
    if (oauthToken && Date.now() < oauthExpires)
        return oauthToken;
    console.log("Fetching new Twitch OAuth token");
    const data = JSON.parse(request({
        url: "https://id.twitch.tv/oauth2/token",
        qs: {
            client_id: twitchAuth.id,
            client_secret: twitchAuth.secret,
            grant_type: "client_credentials",
        },
        method: "POST",
    }).toString());
    oauthToken = data.access_token;
    oauthExpires = Date.now() + (data.expires_in - 20) * 1000;
    return oauthToken;
}
async function getTwitchApi(path, params) {
    const token = await getTwitchOauthToken();
    const r = () => request({
        url: `https://api.twitch.tv/helix/${path}`,
        qs: params,
        qsStringifyOptions: { arrayFormat: "repeat" },
        headers: {
            "Client-ID": twitchAuth.id,
            Authorization: `Bearer ${token}`,
        },
    });
    let res = JSON.parse(r().toString());
    const { data } = res;
    while (res.data.length &&
        res.pagination &&
        res.pagination.cursor &&
        res.pagination.cursor !== "IA") {
        params.after = res.pagination.cursor;
        res = JSON.parse(r().toString());
        data.push(...res.data);
    }
    return data;
}
export default (_client, _config) => {
    client = _client;
    config = _config;
    if (config.cleanupStreams) {
        initCleanupStreamsChannels();
    }
    if (config.linksOnly) {
        initMoniterLinksOnlyChannels();
    }
    if (config.mediaOnly) {
        initMonitorMediaOnlyChannels();
    }
};
