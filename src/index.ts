import { readFileSync } from "fs";
import { Client, ClientApplication, ClientUser, Intents } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandStringOption } from "@discordjs/builders";
import JiraApi from "jira-client";
import { Config } from "./types.js";

const config: Config = JSON.parse(readFileSync("./config.json").toString());

const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

client.on("ready", () => {
    const user: ClientUser |  null = client.user;
    if (!user) return;

    console.log(`Logged in as ${user.tag}!`);
    // Set the presence for the bot (Listening to !help)
    user.setPresence({
        status: "online",
        activities: [{ name: `${config["prefix"]}help`, type: "LISTENING" }],
    });
});

const jira = new JiraApi({
    protocol: "https",
    host: config["host"],
    port: "443",
    username: config["user"],
    password: config["password"],
    apiVersion: "2",
    strictSSL: true,
});

(async () => {
    const commands: SlashCommandStringOption[] = [];

    for (const module of ["eigenbot", "scicraft", "minecraft-version", "mindtech"]) {
        const m = await import(`./${module}.js`);
        const moduleCommands = (await m.default(client, config, jira)) || [];
        for (const command of moduleCommands) {
            if (command.toJSON) {
                commands.push(command.toJSON());
            } else {
                commands.push(command);
            }
        }
    }

    if (!commands.length) return;
    const rest = new REST({ version: "9" }).setToken(config["token"]);
    client.on("ready", () => {
        const app: ClientApplication | null = client.application;
        if (!app) return;

        const clientId = (app.id as string);
        rest.put(
            config["guild"]
                ? Routes.applicationGuildCommands(clientId, config["guild"])
                : Routes.applicationCommands(clientId),
            { body: commands }
        );
    });

    // Login with token
    client.login(config["token"]);
})();
