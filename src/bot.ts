import { Client, GatewayIntentBits } from "discord.js";
import { LavalinkManager } from "lavalink-client";
import { registerEvents } from "./events.js";
import { setupLavalink } from "./lavalink.js";

export let client: Client;
export let lavalink: LavalinkManager;

export async function startBot() {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    console.error("[bot] DISCORD_TOKEN not set — cannot start");
    process.exit(1);
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
  });

  lavalink = setupLavalink(client);
  registerEvents(client, lavalink);

  await client.login(token);
  console.log("[bot] Logged in to Discord");
}
