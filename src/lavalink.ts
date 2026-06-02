import { Client } from "discord.js";
import { LavalinkManager, type Track } from "lavalink-client";
import { sendNowPlayingMessage, disableNowPlayingButtons } from "./buttons.js";

export function setupLavalink(client: Client): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: [
      {
        // Non-SSL port 80 — no certificate issues on any host
        host: "lavalinkv4.serenetia.com",
        port: 80,
        authorization: "https://dsc.gg/ajidevserver",
        secure: false,
        id: "node1",
        retryAmount: 999,
        retryDelay: 10000,
      },
      {
        // Backup non-SSL
        host: "lavalink.serenetia.com",
        port: 80,
        authorization: "https://dsc.gg/ajidevserver",
        secure: false,
        id: "node2",
        retryAmount: 999,
        retryDelay: 10000,
      },
      {
        // SSL backup with cert check disabled via NODE_TLS_REJECT_UNAUTHORIZED=0
        host: "lava-v4.ajieblogs.eu.org",
        port: 443,
        authorization: "https://dsc.gg/ajidevserver",
        secure: true,
        id: "node3",
        retryAmount: 999,
        retryDelay: 10000,
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
    console.log(`[lavalink] Node "${node.id}" connected ✅`);
  });
  manager.nodeManager.on("error", (node, error) => {
    console.error(`[lavalink] Node "${node.id}" error: ${error?.message ?? String(error)}`);
  });
  manager.nodeManager.on("disconnect", (node) => {
    console.warn(`[lavalink] Node "${node.id}" disconnected — retrying in 10s…`);
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
