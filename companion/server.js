import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.LIVE_PIN_BRIDGE_PORT ?? 9742);
const PING_INTERVAL_MS = 15000;

/** @type {Map<string, { id: string; name: string; url: string; pinned?: boolean }>} */
const links = new Map();

/** @type {string | null} */
let pinnedLinkId = null;

/** @type {import("ws").WebSocket | null} */
let extensionSocket = null;

/**
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<any>}
 */
async function readJson(req) {
	const chunks = [];

	for await (const chunk of req) {
		chunks.push(chunk);
	}

	if (chunks.length === 0) {
		return {};
	}

	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * @param {import("http").ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	});
	res.end(JSON.stringify(body));
}

/**
 * @param {Array<{ id: string; name: string; url: string; pinned?: boolean }>} incoming
 */
function replaceLinks(incoming) {
	links.clear();

	for (const link of incoming) {
		if (!link?.id || !link?.url) {
			continue;
		}

		links.set(link.id, {
			id: link.id,
			name: link.name ?? link.url,
			url: link.url,
			pinned: !!link.pinned,
		});
	}

	const pinned = incoming.find((link) => link.pinned);
	pinnedLinkId = pinned?.id ?? null;
}

function getStatusPayload() {
	return {
		connected: extensionSocket?.readyState === extensionSocket?.OPEN,
		pinnedLinkId,
		links: [...links.values()].map((link) => ({
			...link,
			pinned: pinnedLinkId === link.id,
		})),
	};
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @param {number} timeoutMs
 */
function forwardToExtension(type, payload, timeoutMs = 12000) {
	if (!extensionSocket || extensionSocket.readyState !== extensionSocket.OPEN) {
		return Promise.resolve({ success: false, error: "Browser extension not connected" });
	}

	return new Promise((resolve) => {
		const requestId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const timeout = setTimeout(() => {
			cleanup();
			resolve({ success: false, error: "Timed out waiting for browser" });
		}, timeoutMs);

		/**
		 * @param {import("ws").RawData} raw
		 */
		const onMessage = (raw) => {
			try {
				const message = JSON.parse(raw.toString());

				if (message.requestId !== requestId) {
					return;
				}

				cleanup();
				resolve(message);
			} catch {
				// Ignore malformed messages.
			}
		};

		const cleanup = () => {
			clearTimeout(timeout);
			extensionSocket?.off("message", onMessage);
		};

		extensionSocket.on("message", onMessage);
		extensionSocket.send(JSON.stringify({ type, requestId, ...payload }));
	});
}

async function refreshLinksFromPage() {
	await forwardToExtension("refreshLinks", {}, 8000);
	return getStatusPayload();
}

const server = http.createServer(async (req, res) => {
	if (req.method === "OPTIONS") {
		sendJson(res, 204, {});
		return;
	}

	try {
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

		if (req.method === "GET" && url.pathname === "/api/status") {
			if (url.searchParams.get("refresh") === "1") {
				sendJson(res, 200, await refreshLinksFromPage());
				return;
			}

			sendJson(res, 200, getStatusPayload());
			return;
		}

		if (req.method === "POST" && url.pathname === "/api/links/refresh") {
			sendJson(res, 200, await refreshLinksFromPage());
			return;
		}

		if (req.method === "POST" && url.pathname === "/api/toggle") {
			const body = await readJson(req);
			const linkId = body.linkId;

			if (!linkId) {
				sendJson(res, 400, { success: false, pinned: false, linkId: "", error: "linkId is required" });
				return;
			}

			const link = links.get(linkId);
			const result = await forwardToExtension("toggle", { linkId, link });

			if (result.success) {
				pinnedLinkId = result.pinned ? linkId : null;
			}

			sendJson(res, result.success ? 200 : 503, {
				success: !!result.success,
				pinned: !!result.pinned,
				linkId,
				error: result.error,
			});
			return;
		}

		sendJson(res, 404, { error: "Not found" });
	} catch (error) {
		sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : "Server error" });
	}
});

const wss = new WebSocketServer({ server, path: "/extension" });

wss.on("connection", (socket) => {
	if (extensionSocket && extensionSocket.readyState === extensionSocket.OPEN) {
		extensionSocket.close();
	}

	extensionSocket = socket;
	console.log("Browser extension connected");

	socket.on("close", () => {
		if (extensionSocket === socket) {
			extensionSocket = null;
			console.log("Browser extension disconnected");
		}
	});

	socket.on("message", (raw) => {
		try {
			const payload = JSON.parse(raw.toString());

			if (payload.type === "linksUpdated" && Array.isArray(payload.links)) {
				replaceLinks(payload.links);
				pinnedLinkId = payload.pinnedLinkId ?? pinnedLinkId;
				console.log(`Links updated (${payload.links.length} found, pinned: ${pinnedLinkId ?? "none"})`);
				return;
			}

			if (payload.type === "pong") {
				socket.isAlive = true;
			}
		} catch {
			// Ignore malformed messages.
		}
	});

	socket.send(JSON.stringify({ type: "hello", pinnedLinkId }));
	socket.send(JSON.stringify({ type: "refreshLinks" }));
});

setInterval(() => {
	if (!extensionSocket || extensionSocket.readyState !== extensionSocket.OPEN) {
		return;
	}

	if (extensionSocket.isAlive === false) {
		extensionSocket.terminate();
		return;
	}

	extensionSocket.isAlive = false;
	extensionSocket.send(JSON.stringify({ type: "ping" }));
}, PING_INTERVAL_MS);

server.listen(PORT, "127.0.0.1", () => {
	console.log(`Live Pin bridge listening on http://127.0.0.1:${PORT}`);
});
