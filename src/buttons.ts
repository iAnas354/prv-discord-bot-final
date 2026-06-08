import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  type TextBasedChannel,
} from "discord.js";
import type { Player, Track } from "lavalink-client";

export const nowPlayingMessages = new Map<string, Message>();

export function buildControlRow(paused: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_pause").setEmoji(paused ? "▶️" : "⏸️").setLabel(paused ? "Resume" : "Pause").setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭️").setLabel("Skip").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹️").setLabel("Stop").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_vol_down").setEmoji("🔉").setLabel("-10").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_vol_up").setEmoji("🔊").setLabel("+10").setStyle(ButtonStyle.Secondary),
  );
}

export function buildLoopRow(repeatMode: string): ActionRowBuilder<ButtonBuilder> {
  const isTrack = repeatMode === "track";
  const isQueue = repeatMode === "queue";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("music_loop")
      .setEmoji(isTrack ? "🔂" : isQueue ? "🔁" : "➡️")
      .setLabel(isTrack ? "Loop: Track" : isQueue ? "Loop: Queue" : "Loop: Off")
      .setStyle(isTrack || isQueue ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
}

export function buildNowPlayingEmbed(track: Track, player: Player): EmbedBuilder {
  const pos = player.position ?? 0;
  const dur = track.info.duration;
  const filled = Math.max(0, Math.min(15, Math.round((pos / dur) * 15)));
  const bar = "▓".repeat(filled) + "░".repeat(15 - filled);
  const fmt = (ms: number) => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`; };
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎵 Now Playing")
    .setDescription(`**[${track.info.title}](${track.info.uri})**\nby **${track.info.author}**`)
    .addFields(
      { name: "Progress", value: `${bar}\n\`${fmt(pos)} / ${fmt(dur)}\``, inline: false },
      { name: "Volume", value: `${player.volume}%`, inline: true },
      { name: "Queue", value: `${player.queue.tracks.length} track(s) up next`, inline: true },
    )
    .setThumbnail(track.info.artworkUrl ?? null)
    .setFooter({ text: `Requested by ${(track.requester as any)?.username ?? "someone"}` });
}

export async function sendNowPlayingMessage(channel: TextBasedChannel, player: Player, track: Track): Promise<void> {
  const old = nowPlayingMessages.get(player.guildId);
  if (old) { old.delete().catch(() => {}); nowPlayingMessages.delete(player.guildId); }
  const msg = await (channel as any).send({ embeds: [buildNowPlayingEmbed(track, player)], components: [buildControlRow(player.paused), buildLoopRow(player.repeatMode ?? "off")] });
  nowPlayingMessages.set(player.guildId, msg);
}

export async function updateNowPlayingButtons(guildId: string, paused: boolean, repeatMode = "off"): Promise<void> {
  const msg = nowPlayingMessages.get(guildId);
  if (!msg) return;
  try { await msg.edit({ components: [buildControlRow(paused), buildLoopRow(repeatMode)] }); }
  catch { nowPlayingMessages.delete(guildId); }
}

export async function disableNowPlayingButtons(guildId: string, label = "Finished"): Promise<void> {
  const msg = nowPlayingMessages.get(guildId);
  if (!msg) return;
  try {
    await msg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("music_done").setLabel(label).setStyle(ButtonStyle.Secondary).setDisabled(true))] });
  } catch {}
  nowPlayingMessages.delete(guildId);
}
