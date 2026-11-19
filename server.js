
import http from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const PORT = Number(process.env.PORT || 10000);

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

    response.writeHead(404, {
        "Content-Type": "application/json"
    });

    response.end(JSON.stringify({
        error: "Not found"
    }));
});

server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
        request.url,
        "http://localhost"
    ).pathname;

    if (pathname !== "/wisp/") {
        socket.destroy();
        return;
    }

    wisp.routeRequest(request, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`StudySpace Wisp Transport listening on ${PORT}`);
});
