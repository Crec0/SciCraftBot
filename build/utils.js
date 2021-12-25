import { CommandInteraction } from "discord.js";
import fetch from "node-fetch";
function makeStringPayload(response) {
    return { content: response, allowedMentions: { repliedUser: false } };
}
function makeEmbedPayload(embed) {
    return { embeds: [embed], allowedMentions: { repliedUser: false } };
}
function replyMessage(interaction, response) {
    let payload;
    if (typeof response === "string") {
        payload = makeStringPayload(response);
    }
    else {
        payload = makeEmbedPayload(response);
    }
    if (interaction instanceof CommandInteraction) {
        return interaction.editReply(payload);
    }
    else {
        return interaction.reply(payload);
    }
}
function editMessage(interaction, response) {
    let payload;
    if (typeof response === "string") {
        payload = makeStringPayload(response);
    }
    else {
        payload = makeEmbedPayload(response);
    }
    if (interaction instanceof CommandInteraction) {
        return interaction.editReply(payload);
    }
    else {
        return interaction.edit(payload);
    }
}
export async function fetchTimeout(url, ms, options) {
    const controller = new AbortController();
    const promise = fetch(url, Object.assign({ signal: controller.signal }, options));
    const timeout = setTimeout(() => controller.abort(), ms);
    return promise.finally(() => clearTimeout(timeout));
}
;
export { replyMessage, editMessage };
