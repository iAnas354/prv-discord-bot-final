import { Client } from "discord.js";
import { LavalinkManager, type Track } from "lavalink-client";
import { sendNowPlayingMessage, disableNowPlayingButtons } from "./buttons.js";

export function setupLavalink(client: Client): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: [
      {
        host: "lavalink.devamop.in",
        port: 443,
        authorization: "DevamopInHosting",
        secure: true,
        id: "node1",
        retryAmount: 999,
        retryDelay: 15000,
      },
      {
        host: "lava-v4.millohost.my.id",
        port: 443,
        authorization: "https://discord.gg/mjS5J2K3ep",
        secure: true,
        id: "node2",
        retryAmount: 999,
        retryDelay: 15000,
      },
      {
        host: "lavalinkv4.serenetia.com",
        port: 443,
        authorization: "https://seretia.link/discord",
        secure: true,
        id: "node3",
        retryAmount: 999,
        retryDelay: 15000,
      },
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    client: {
      id: process.env["DISCORD_CLIENT_ID"] ?? "",
      username: "MusicBot",
    },
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      volumeDecrementer: 0.75,
      onDisconnect: {
        autoReconnect: true,
        autoReconnectOn
