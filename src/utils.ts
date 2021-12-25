import { Embed } from "@discordjs/builders";
import { CommandInteraction, HTTPOptions, Message, WebhookMessageOptions } from "discord.js";
import { APIMessage } from "discord.js/node_modules/discord-api-types";
import fetch from "node-fetch";

function makeStringPayload(response: string): WebhookMessageOptions {
    return { content: response, allowedMentions: { repliedUser: false } };
}

function makeEmbedPayload(embed: Embed): WebhookMessageOptions {
    return { embeds: [embed], allowedMentions: { repliedUser: false } };
}

function replyMessage(
    interaction: Message | CommandInteraction,
    response: string | Embed
): Promise<Message<true> | APIMessage | Message<boolean>> {
    let payload: WebhookMessageOptions;
    if (typeof response === "string") {
        payload = makeStringPayload(response);
    } else {
        payload = makeEmbedPayload(response);
    }

    if (interaction instanceof CommandInteraction) {
        return interaction.editReply(payload);
    } else {
        return interaction.reply(payload);
    }
}

function editMessage(
    interaction: Message | CommandInteraction,
    response: string | Embed
): Promise<Message<true> | APIMessage | Message<boolean>> {
    let payload: WebhookMessageOptions;
    if (typeof response === "string") {
        payload = makeStringPayload(response);
    } else {
        payload = makeEmbedPayload(response);
    }

    if (interaction instanceof CommandInteraction) {
        return interaction.editReply(payload);
    } else {
        return interaction.edit(payload);
    }
}

export async function fetchTimeout(url: string, ms: number, options?: HTTPOptions | any) {
    const controller = new AbortController();
    const promise = fetch(url, { signal: controller.signal, ...options });
    const timeout = setTimeout(() => controller.abort(), ms);
    return promise.finally(() => clearTimeout(timeout));
};


export { replyMessage, editMessage };
