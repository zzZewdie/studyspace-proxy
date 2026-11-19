
import http from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const PORT = Number(process.env.PORT || 10000);

// Restrict destination ports and block private-network access.
wisp.options.port_whitelist = [80, 443];
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
wisp.options.allow_direct_ip = false;

// Limit connections per client.
wisp.options.stream_limit_per_host = 8;
wisp.options.stream_limit_total = 30;
wisp.options.allow_udp_streams = false;
wisp.options.allow_tcp_streams = true;

// Require a configured secret before accepting WebSocket connections.
const PROXY_SECRET = process.env.PROXY_SECRET;

const server = http.createServer((request, response) => {
    if (request.url === "/health") {
        response.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });

        response.end(JSON.stringify({
            success: true,
            service: "StudySpace Wisp Transport",
            status: "online"
        }));
        return;
    }

    response.writeHead(404);
    response.end("Not found");
});

server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
        request.url,
        "http://localhost"
    ).pathname;

    if (pathname !== "/wisp/" || !PROXY_SECRET) {
        socket.destroy();
        return;
    }

    const suppliedSecret = request.headers["x-studyspace-secret"];

    if (
        typeof suppliedSecret !== "string" ||
        suppliedSecret !== PROXY_SECRET
    ) {
        socket.destroy();
        return;
    }

    wisp.routeRequest(request, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`StudySpace transport listening on ${PORT}`);
});
