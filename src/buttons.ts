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
    new ButtonBuilder()
      .setCustomId("music_pause")
      .setEmoji(paused ? "▶️" : "⏸️")
      .setLabel(paused ? "Resume" : "Pause")
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_skip")
      .setEmoji("⏭️")
      .setLabel("Skip")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music_stop")
      .setEmoji("⏹️")
      .setLabel("Stop")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music_vol_down")
      .setEmoji("🔉")
      .setLabel("-10")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_vol_up")
      .setEmoji("🔊")
      .setLabel("+10")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildNowPlayingEmbed(track: Track, player: Player): EmbedBuilder {
  const pos = player.position ?? 0;
  const dur = track.info.duration;
  const bar = buildProgressBar(pos, dur);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎵 Now Playing")
    .setDescription(`**[${track.info.title}](${track.info.uri})**\nby **${track.info.author}**`)
    .addFields(
      { name: "Progress", value: `${bar}\n\`${formatMs(pos)} / ${formatMs(dur)}\``, inline: false },
      { name: "Volume", value: `${player.volume}%`, inline: true },
      { name: "Queue", value: `${player.queue.tracks.length} track(s) up next`, inline: true },
    )
    .setThumbnail(track.info.artworkUrl ?? null)
    .setFooter({ text: `Requested by ${(track.requester as any)?.username ?? "someone"}` });
}

export async function sendNowPlayingMessage(
  channel: TextBasedChannel,
  player: Player,
  track: Track
): Promise<void> {
  const old = nowPlayingMessages.get(player.guildId);
  if (old) {
    old.delete().catch(() => {});
    nowPlayingMessages.delete(player.guildId);
  }
  const embed = buildNowPlayingEmbed(track, player);
  const row = buildControlRow(player.paused);
  const msg = await (channel as any).send({ embeds: [embed], components: [row] });
  nowPlayingMessages.set(player.guildId, msg);
}

export async function updateNowPlayingButtons(guildId: string, paused: boolean): Promise<void> {
  const msg = nowPlayingMessages.get(guildId);
  if (!msg) return;
  try {
    await msg.edit({ components: [buildControlRow(paused)] });
  } catch {
    nowPlayingMessages.delete(guildId);
  }
}

export async function disableNowPlayingButtons(guildId: string, label = "Finished"): Promise<void> {
  const msg = nowPlayingMessages.get(guildId);
  if (!msg) return;
  try {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music_done")
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
    await msg.edit({ components: [row] });
  } catch {}
  nowPlayingMessages.delete(guildId);
}

function buildProgressBar(pos: number, dur: number): string {
  const filled = Math.max(0, Math.min(15, Math.round((pos / dur) * 15)));
  return "▓".repeat(filled) + "░".repeat(15 - filled);
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
