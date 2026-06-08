import { Message } from "discord.js";
import { LavalinkManager } from "lavalink-client";
import { disableNowPlayingButtons } from "./buttons.js";

const OWNER_ID = process.env["DISCORD_OWNER_ID"] ?? "";

export async function handleCommand(
  name: string,
  args: string[],
  message: Message,
  lavalink: LavalinkManager
) {
  switch (name) {
    case "help":      return cmdHelp(message);
    case "join":      return cmdJoin(message, lavalink);
    case "play":
    case "p":         return cmdPlay(args, message, lavalink);
    case "pause":     return cmdPause(message, lavalink);
    case "resume":    return cmdResume(message, lavalink);
    case "skip":
    case "s":         return cmdSkip(message, lavalink);
    case "stop":      return cmdStop(message, lavalink);
    case "queue":
    case "q":         return cmdQueue(message, lavalink);
    case "nowplaying":
    case "np":        return cmdNowPlaying(message, lavalink);
    case "volume":
    case "vol":       return cmdVolume(args, message, lavalink);
    case "loop":
    case "l":         return cmdLoop(args, message, lavalink);
    case "leave":     return cmdLeave(message, lavalink);
    default:          return;
  }
}

async function cmdHelp(message: Message) {
  await message.reply(
    "🎵 **Music Bot Commands**\n" +
    "`!join` — Join your voice channel\n" +
    "`!play <song or URL>` — Play from YouTube\n" +
    "`!pause` / `!resume` — Pause / resume\n" +
    "`!skip` — Skip current song\n" +
    "`!stop` — Stop & clear queue (stays in channel)\n" +
    "`!queue` — Show queue\n" +
    "`!np` — Now playing\n" +
    "`!volume <1-100>` — Set volume\n" +
    "`!loop` — Cycle loop: Off → 🔂 Track → 🔁 Queue → Off\n" +
    "`!leave` — Leave voice (owner only)\n\n" +
    "💡 **Tip:** Each song shows a control panel with ⏸ ⏭ ⏹ 🔉 🔊 🔁 buttons!"
  );
}

async function getOrCreatePlayer(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return null;
  const member = message.guild.members.cache.get(message.author.id);
  const voiceChannel = member?.voice.channel;
  if (!voiceChannel) {
    await message.reply("❌ You need to be in a voice channel first!");
    return null;
  }
  let player = lavalink.getPlayer(message.guild.id);
  if (!player) {
    player = await lavalink.createPlayer({
      guildId: message.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: message.channel.id,
      selfDeaf: true,
      selfMute: false,
      volume: 80,
    });
  } else {
    player.textChannelId = message.channel.id;
  }
  if (!player.connected) await player.connect();
  return player;
}

async function cmdJoin(message: Message, lavalink: LavalinkManager) {
  const player = await getOrCreatePlayer(message, lavalink);
  if (player) {
    await message.reply(`✅ Joined <#${player.voiceChannelId}>! I'll stay here permanently.`);
  }
}

async function cmdPlay(args: string[], message: Message, lavalink: LavalinkManager) {
  if (!args.length) {
    await message.reply("❌ Provide a song name or URL. Example: `!play blinding lights`");
    return;
  }
  const player = await getOrCreatePlayer(message, lavalink);
  if (!player) return;

  const query = args.join(" ");
  const searching = await message.reply(`🔍 Searching: **${query}**...`);
  const searchResult = await player.search({ query, source: "ytsearch" }, message.author);
  await searching.delete().catch(() => {});

  if (!searchResult || searchResult.loadType === "empty" || searchResult.loadType === "error") {
    await message.reply("❌ No results found. Try a different search or paste a YouTube URL.");
    return;
  }

  if (searchResult.loadType === "playlist") {
    player.queue.add(searchResult.tracks);
    await message.reply(
      `✅ Added playlist **${(searchResult as any).playlist?.title ?? "Playlist"}** (${searchResult.tracks.length} tracks) to queue.`
    );
  } else {
    const track = searchResult.tracks[0];
    if (!track) { await message.reply("❌ No playable track found."); return; }
    player.queue.add(track);
    if (player.playing || player.paused) {
      await message.reply(
        `✅ Added **${track.info.title}** by ${track.info.author} \`[${formatMs(track.info.duration ?? 0)}]\` to queue.`
      );
    }
  }

  if (!player.playing && !player.paused) {
    await player.play({ paused: false });
  }
}

async function cmdPause(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player?.playing) { await message.reply("❌ Nothing is playing right now."); return; }
  await player.pause();
  await message.reply("⏸️ Paused.");
}

async function cmdResume(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player) { await message.reply("❌ Nothing to resume."); return; }
  await player.resume();
  await message.reply("▶️ Resumed.");
}

async function cmdSkip(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player?.playing && !player?.paused) { await message.reply("❌ Nothing is playing."); return; }
  try {
    if (player.queue.tracks.length > 0) {
      await player.skip();
      await message.reply("⏭️ Skipped.");
    } else {
      await disableNowPlayingButtons(message.guild.id, "Skipped");
      await player.stopPlaying(false, false);
      await message.reply("⏭️ Skipped — that was the last track. Queue is now empty.");
    }
  } catch {
    await player.stopPlaying(false, false);
    await message.reply("⏭️ Skipped.");
  }
}

async function cmdStop(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player) { await message.reply("❌ Nothing is playing."); return; }
  player.queue.tracks.splice(0, player.queue.tracks.length);
  await disableNowPlayingButtons(message.guild.id, "Stopped");
  await player.stopPlaying(false, false);
  await message.reply("⏹️ Stopped and cleared queue. Still in the channel — use `!play` to start again.");
}

async function cmdQueue(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player || (!player.playing && !player.paused && player.queue.tracks.length === 0)) {
    await message.reply("❌ The queue is empty.");
    return;
  }
  const current = player.queue.current;
  const upcoming = player.queue.tracks.slice(0, 10);
  let reply = "";
  if (current) reply += `▶️ **Now Playing:** ${current.info.title} — ${current.info.author} \`[${formatMs(current.info.duration)}]\`\n\n`;
  if (upcoming.length > 0) {
    reply += "**Up Next:**\n";
    upcoming.forEach((t, i) => { reply += `${i + 1}. ${t.info.title} — ${t.info.author} \`[${formatMs(t.info.duration ?? 0)}]\`\n`; });
    if (player.queue.tracks.length > 10) reply += `\n...and ${player.queue.tracks.length - 10} more.`;
  } else {
    reply += "No more tracks in queue.";
  }
  await message.reply(reply || "Queue is empty.");
}

async function cmdNowPlaying(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  const current = player?.queue.current;
  if (!player || !current) { await message.reply("❌ Nothing is playing right now."); return; }
  const pos = player.position;
  const dur = current.info.duration;
  const bar = buildProgressBar(pos, dur);
  await message.reply(
    `🎵 **Now Playing**\n**${current.info.title}** by ${current.info.author}\n\n${bar}\n\`${formatMs(pos)} / ${formatMs(dur)}\``
  );
}

async function cmdVolume(args: string[], message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player) { await message.reply("❌ No active player — use `!join` first."); return; }
  const vol = parseInt(args[0] ?? "", 10);
  if (isNaN(vol) || vol < 1 || vol > 100) { await message.reply("❌ Volume must be 1–100."); return; }
  await player.setVolume(vol);
  await message.reply(`🔊 Volume set to **${vol}%**`);
}

async function cmdLoop(args: string[], message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  const player = lavalink.getPlayer(message.guild.id);
  if (!player) { await message.reply("❌ Nothing is playing right now."); return; }

  const modes = ["off", "track", "queue"] as const;
  type LoopMode = typeof modes[number];

  let next: LoopMode;
  if (args[0] === "track" || args[0] === "song") next = "track";
  else if (args[0] === "queue" || args[0] === "all") next = "queue";
  else if (args[0] === "off") next = "off";
  else {
    const current = (player.repeatMode ?? "off") as LoopMode;
    const idx = modes.indexOf(current);
    next = modes[(idx + 1) % modes.length]!;
  }

  player.setRepeatMode(next);

  const labels: Record<LoopMode, string> = {
    off:   "➡️ Loop **off**",
    track: "🔂 Looping **current track**",
    queue: "🔁 Looping **entire queue**",
  };
  await message.reply(labels[next]);
}

async function cmdLeave(message: Message, lavalink: LavalinkManager) {
  if (!message.guild) return;
  if (message.author.id !== OWNER_ID) { await message.reply("❌ Only the bot owner can make the bot leave."); return; }
  const player = lavalink.getPlayer(message.guild.id);
  if (player) {
    await player.destroy();
    await message.reply("👋 Left the voice channel.");
  } else {
    await message.reply("❌ I'm not in a voice channel.");
  }
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
