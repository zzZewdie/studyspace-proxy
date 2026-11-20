
import http from "node:http";
import {
    createHmac,
    timingSafeEqual
} from "node:crypto";

import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const PORT = Number(process.env.PORT || 10000);
const TICKET_SECRET = process.env.TICKET_SECRET;

const ALLOWED_ORIGINS = new Set([
    "https://studyspace-c7f91.web.app",
    "https://studyspace-c7f91.firebaseapp.com",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);

// Initial destination protections.
wisp.options.port_whitelist = [80, 443];
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
wisp.options.allow_direct_ip = false;
wisp.options.allow_udp_streams = false;
wisp.options.allow_tcp_streams = true;

wisp.options.stream_limit_per_host = 8;
wisp.options.stream_limit_total = 30;

function verifyTicket(ticket) {
    if (!TICKET_SECRET || !ticket || ticket.length > 4096) {
        return false;
    }

    const parts = ticket.split(".");

    if (parts.length !== 3) return false;

    const [headerPart, payloadPart, signaturePart] = parts;

    const expectedSignature = createHmac(
        "sha256",
        TICKET_SECRET
    )
        .update(`${headerPart}.${payloadPart}`)
        .digest();

    let suppliedSignature;

    try {
        suppliedSignature = Buffer.from(
            signaturePart,
            "base64url"
        );
    } catch {
        return false;
    }

    if (
        suppliedSignature.length !== expectedSignature.length ||
        !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
        return false;
    }

    try {
        const header = JSON.parse(
            Buffer.from(headerPart, "base64url").toString()
        );

        const payload = JSON.parse(
            Buffer.from(payloadPart, "base64url").toString()
        );

        const now = Math.floor(Date.now() / 1000);

        return (
            header.alg === "HS256" &&
            header.typ === "JWT" &&
            payload.iss === "studyspace" &&
            payload.aud === "studyspace-wisp" &&
            typeof payload.sub === "string" &&
            Number.isFinite(payload.exp) &&
            payload.exp > now &&
            payload.exp <= now + 120
        );
    } catch {
        return false;
    }
}

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
    let url;

    try {
        url = new URL(request.url, "http://localhost");
    } catch {
        socket.destroy();
        return;
    }

    const origin = request.headers.origin;
    const ticket = url.searchParams.get("ticket");

    if (
        url.pathname !== "/wisp/" ||
        !ALLOWED_ORIGINS.has(origin) ||
        !verifyTicket(ticket)
    ) {
        socket.destroy();
        return;
    }

    // Do not log tickets or connection query strings.
    wisp.routeRequest(request, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`StudySpace transport listening on ${PORT}`);
});
