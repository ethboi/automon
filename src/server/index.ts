import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { GameEngine } from "../engine/engine";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const dashboardRoot = path.resolve(process.cwd(), "src/dashboard");

const mimeFor = (filePath: string): string => {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
};

const engine = new GameEngine();

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";

  if (url === "/api/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(engine.getWorldSnapshot()));
    return;
  }

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
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
};

wss.on("connection", (socket: any) => {
  socket.send(JSON.stringify({ type: "snapshot", data: engine.getWorldSnapshot() }));
});

engine.on("state", () => {
  sendSnapshot();
});

server.listen(PORT, HOST, () => {
  console.log(`AutoMon server running on http://:${PORT}`);
  console.log("Dashboard: /dashboard");
  console.log("Set OPENAI_API_KEY to enable gpt-4o-mini decisions.");
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
