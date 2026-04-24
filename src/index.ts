import http from "http";
import { startBot } from "./bot.js";

// Simple HTTP health-check server so UptimeRobot / Railway can ping it
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("🎵 Music Bot is running!");
});
server.listen(PORT, () => {
  console.log(`[health] HTTP server listening on port ${PORT}`);
});

startBot().catch((err) => {
  console.error("[fatal] Bot crashed:", err);
  process.exit(1);
});
