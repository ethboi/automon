import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { GameEngine } from "../engine/engine";

const PORT = Number(process.env.SIM_PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const dashboardRoot = path.resolve(process.cwd(), "src/dashboard");

const mimeFor = (filePath: string): string => {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/plain; charset=utf-8";
};

const engine = new GameEngine();

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";

  // API endpoints
  if (url === "/api/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(engine.getWorldSnapshot()));
    return;
  }

  // Serve dashboard files
  let filePath = "";
  if (url === "/" || url === "/dashboard" || url === "/dashboard/") {
    filePath = path.join(dashboardRoot, "index.html");
  } else if (url.startsWith("/dashboard/")) {
    filePath = path.join(dashboardRoot, url.replace("/dashboard/", ""));
  }

  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { "content-type": mimeFor(filePath) });
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server });

const sendSnapshot = () => {
  const payload = JSON.stringify({ type: "snapshot", data: engine.getWorldSnapshot() });
  Array.from(wss.clients).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
};

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "snapshot", data: engine.getWorldSnapshot() }));

  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "command") {
        handleCommand(msg.command, msg.value);
      }
    } catch { /* ignore bad messages */ }
  });
});

function handleCommand(command: string, value?: number) {
  switch (command) {
    case "pause":
      engine.stop();
      break;
    case "resume":
      engine.start();
      break;
    case "speed":
      if (value && [1, 2, 5, 10].includes(value)) {
        engine.setSpeed(value);
      }
      break;
    case "reset":
      engine.stop();
      engine.reset();
      sendSnapshot();
      engine.start();
      break;
  }
}

engine.on("state", () => {
  sendSnapshot();
});

server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          AutoMon Autonomous World            ║
║  Dashboard: http://${HOST}:${PORT}/dashboard         ║
║  AI: ${process.env.OPENAI_API_KEY ? "OpenAI ✓" : "Fallback (set OPENAI_API_KEY)"}
╚══════════════════════════════════════════════╝
  `);
  engine.start();
});

process.on("SIGINT", () => {
  engine.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  engine.stop();
  process.exit(0);
});
