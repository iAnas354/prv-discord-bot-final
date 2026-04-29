import { Client } from "discord.js";
import { LavalinkManager, type Track } from "lavalink-client";
import { sendNowPlayingMessage, disableNowPlayingButtons } from "./buttons.js";

export function setupLavalink(client: Client): LavalinkManager {
  const host = process.env["LAVALINK_HOST"] ?? "lavalink.jirayu.net";
  const port = parseInt(process.env["LAVALINK_PORT"] ?? "443", 10);
  const password = process.env["LAVALINK_PASSWORD"] ?? "youshallnotpass";
  const secure = process.env["LAVALINK_SECURE"] === "true";

  const manager = new LavalinkManager({
    nodes: [
      {
        host,
        port,
        authorization: password,
        secure,
        id: "main",
        retryAmount: 999,
        retryDelay: 5000,
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
        autoReconnectOnlyWithTracks: false,
      },
      onEmptyQueue: {
        destroyAfterMs: undefined,
      },
    },
  });

  manager.nodeManager.on("connect", (node) => {
    console.log(`[lavalink] Node "${node.id}" connected`);
  });

  manager.nodeManager.on("error", (node, error) => {
    console.error(`[lavalink] Node "${node.id}" error:`, error);
  });

  manager.nodeManager.on("disconnect", (node) => {
    console.warn(`[lavalink] Node "${node.id}" disconnected — retrying…`);
  });

  manager.on("trackStart", (player, track: Track | null) => {
    if (!track) return;
    const channel = client.channels.cache.get(player.textChannelId ?? "");
    if (channel?.isTextBased()) {
      sendNowPlayingMessage(channel, player, track).catch((err) =>
        console.error("[lavalink] Failed to send now-playing:", err)
      );
    }
  });

  manager.on("trackEnd", (player, _track) => {
    if (player.queue.tracks.length === 0) {
      disableNowPlayingButtons(player.guildId, "Queue Finished").catch(() => {});
      const channel = client.channels.cache.get(player.textChannelId ?? "");
      if (channel?.isTextBased() && "send" in channel) {
        (channel as any)
          .send("✅ Queue finished — still in the channel. Use `!play <song>` to add more.")
          .catch(() => {});
      }
    }
  });

  return manager;
}
