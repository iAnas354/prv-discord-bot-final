import { Client, Events, VoiceState, Interaction } from "discord.js";
import { LavalinkManager } from "lavalink-client";
import { handleCommand } from "./commands.js";
import { updateNowPlayingButtons, disableNowPlayingButtons, nowPlayingMessages } from "./buttons.js";
import { EmbedBuilder } from "discord.js";

export function registerEvents(client: Client, lavalink: LavalinkManager) {
  client.on(Events.ClientReady, async (c) => {
    console.log(`[bot] Ready as ${c.user.tag}`);
    c.user.setActivity("music 🎵 | !help", { type: 1 });
    await lavalink.init({ id: c.user.id, username: c.user.username });
    console.log("[bot] Lavalink manager initialized");
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Arabic shortcut: ش <song> → play
    if (message.content.startsWith("ش")) {
      const query = message.content.slice(1).trim();
      try {
        await handleCommand("play", query ? query.split(/\s+/) : [], message, lavalink);
      } catch (err) {
        console.error("[bot] Command error:", err);
        message.reply("❌ Something went wrong.").catch(() => {});
      }
      return;
    }

    if (!message.content.startsWith("!")) return;
    const args = message.content.slice(1).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase() ?? "";
    try {
      await handleCommand(commandName, args, message, lavalink);
    } catch (err) {
      console.error("[bot] Command error:", err);
      message.reply("❌ Something went wrong.").catch(() => {});
    }
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const player = lavalink.getPlayer(guildId);
    await interaction.deferUpdate().catch(() => {});
    if (!player) return;

    switch (interaction.customId) {
      case "music_pause": {
        if (player.paused) {
          await player.resume();
          await updateNowPlayingButtons(guildId, false);
        } else {
          await player.pause();
          await updateNowPlayingButtons(guildId, true);
        }
        break;
      }
      case "music_skip": {
        try {
          if (player.queue.tracks.length > 0) {
            await player.skip();
          } else {
            await disableNowPlayingButtons(guildId, "Skipped");
            await player.stopPlaying(false, false);
          }
        } catch (err) {
          console.error("[bot] Button skip error:", err);
        }
        break;
      }
      case "music_stop": {
        player.queue.tracks.splice(0, player.queue.tracks.length);
        await disableNowPlayingButtons(guildId, "Stopped");
        await player.stopPlaying(false, false);
        const stopCh = client.channels.cache.get(player.textChannelId ?? "");
        if (stopCh?.isTextBased() && "send" in stopCh) {
          (stopCh as any).send("⏹️ Stopped. Still in the channel — use `!play` to start again.").catch(() => {});
        }
        break;
      }
      case "music_vol_down": {
        const newVol = Math.max(10, (player.volume ?? 80) - 10);
        await player.setVolume(newVol);
        const msg = nowPlayingMessages.get(guildId);
        if (msg?.embeds[0]) {
          const updated = EmbedBuilder.from(msg.embeds[0]).setFields(
            ...(msg.embeds[0].fields?.map((f) =>
              f.name === "Volume" ? { ...f, value: `${newVol}%` } : f
            ) ?? [])
          );
          msg.edit({ embeds: [updated] }).catch(() => {});
        }
        break;
      }
      case "music_vol_up": {
        const newVol = Math.min(100, (player.volume ?? 80) + 10);
        await player.setVolume(newVol);
        const msg = nowPlayingMessages.get(guildId);
        if (msg?.embeds[0]) {
          const updated = EmbedBuilder.from(msg.embeds[0]).setFields(
            ...(msg.embeds[0].fields?.map((f) =>
              f.name === "Volume" ? { ...f, value: `${newVol}%` } : f
            ) ?? [])
          );
          msg.edit({ embeds: [updated] }).catch(() => {});
        }
        break;
      }
    }
  });

  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const botId = client.user?.id;
    if (!botId) return;

    if (oldState.member?.id === botId && oldState.channelId && !newState.channelId) {
      const guildId = oldState.guild.id;
      const channelId = oldState.channelId;
      console.warn(`[bot] Kicked from voice in guild ${guildId} — rejoining in 3s`);

      setTimeout(async () => {
        try {
          let player = lavalink.getPlayer(guildId);
          if (player) {
            if (!player.voiceChannelId) (player as any).voiceChannelId = channelId;
            await player.connect();
          } else {
            player = await lavalink.createPlayer({ guildId, voiceChannelId: channelId, selfDeaf: true, volume: 80 });
            await player.connect();
          }
        } catch (err) {
          console.error("[bot] Rejoin failed — retrying in 10s:", err);
          setTimeout(async () => {
            try {
              const p = lavalink.getPlayer(guildId) ??
                await lavalink.createPlayer({ guildId, voiceChannelId: channelId, selfDeaf: true, volume: 80 });
              await p.connect();
            } catch (e2) {
              console.error("[bot] Second rejoin attempt failed:", e2);
            }
          }, 10_000);
        }
      }, 3_000);
    }
  });

  client.on(Events.Raw, (packet) => {
    try {
      lavalink.sendRawData(packet);
    } catch {
      // Node not ready yet — ignore
    }
  });
}
