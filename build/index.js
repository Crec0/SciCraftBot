import { readFileSync } from "fs";
import { Client } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import JiraApi from "jira-client";
const config = JSON.parse(readFileSync("./config.json").toString());
const client = new Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS"],
});
client.on("ready", () => {
    const user = client.user;
    if (!user)
        return;
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
    const commands = [];
    for (const module of ["eigenbot", "scicraft", "minecraft-version", "mindtech"]) {
        const m = await import(`./${module}.js`);
        const moduleCommands = (await m.default(client, config, jira)) || [];
        for (const command of moduleCommands) {
            if (command.toJSON) {
                commands.push(command.toJSON());
            }
            else {
                commands.push(command);
            }
        }
    }
    if (!commands.length)
        return;
    const rest = new REST({ version: "9" }).setToken(config["token"]);
    client.on("ready", () => {
        const app = client.application;
        if (!app)
            return;
        const clientId = app.id;
        rest.put(config["guild"]
            ? Routes.applicationGuildCommands(clientId, config["guild"])
            : Routes.applicationCommands(clientId), { body: commands });
    });
    // Login with token
    await client.login(config["token"]);
})();
