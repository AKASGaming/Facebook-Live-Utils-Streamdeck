import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.LIVE_PIN_BRIDGE_PORT ?? 9742);

/** @type {Map<string, { id: string; name: string; url: string; message?: string }>} */
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
 * @param {{ id: string; name: string; url: string; message?: string }} link
 */
function upsertLink(link) {
	if (!link?.id) {
		return;
	}

	links.set(link.id, {
		id: link.id,
		name: link.name ?? link.id,
		url: link.url ?? "",
		message: link.message ?? "",
	});
}

/**
 * @returns {Promise<{ success: boolean; pinned: boolean; linkId: string; error?: string }>}
 */
async function forwardToggle(linkId) {
	const link = links.get(linkId);

	if (!link) {
		return { success: false, pinned: false, linkId, error: "Unknown link" };
	}

	if (!extensionSocket || extensionSocket.readyState !== extensionSocket.OPEN) {
		return { success: false, pinned: false, linkId, error: "Browser extension not connected" };
	}

	return new Promise((resolve) => {
		const requestId = `toggle-${Date.now()}`;

		const timeout = setTimeout(() => {
			cleanup();
			resolve({ success: false, pinned: pinnedLinkId === linkId, linkId, error: "Timed out waiting for browser" });
		}, 12000);

		/**
		 * @param {import("ws").RawData} raw
		 */
		const onMessage = (raw) => {
			try {
				const payload = JSON.parse(raw.toString());

				if (payload.requestId !== requestId) {
					return;
				}

				cleanup();

				if (payload.success) {
					pinnedLinkId = payload.pinned ? linkId : null;
				}

				resolve({
					success: !!payload.success,
					pinned: !!payload.pinned,
					linkId,
					error: payload.error,
				});
			} catch {
				// Ignore malformed messages.
			}
		};

		const cleanup = () => {
			clearTimeout(timeout);
			extensionSocket?.off("message", onMessage);
		};

		extensionSocket.on("message", onMessage);
		extensionSocket.send(
			JSON.stringify({
				type: "toggle",
				requestId,
				link,
				currentPinnedLinkId: pinnedLinkId,
			}),
		);
	});
}

const server = http.createServer(async (req, res) => {
	if (req.method === "OPTIONS") {
		sendJson(res, 204, {});
		return;
	}

	try {
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

		if (req.method === "GET" && url.pathname === "/api/status") {
			sendJson(res, 200, {
				connected: extensionSocket?.readyState === extensionSocket?.OPEN,
				pinnedLinkId,
				links: [...links.values()].map((link) => ({
					...link,
					pinned: pinnedLinkId === link.id,
				})),
			});
			return;
		}

		if (req.method === "POST" && url.pathname === "/api/links/sync") {
			const body = await readJson(req);
			const incoming = Array.isArray(body.links) ? body.links : [];

			for (const link of incoming) {
				upsertLink(link);
			}

			sendJson(res, 200, { success: true, count: links.size });
			return;
		}

		if (req.method === "POST" && url.pathname === "/api/toggle") {
			const body = await readJson(req);

			if (body.link) {
				upsertLink(body.link);
			}

			const linkId = body.linkId;

			if (!linkId) {
				sendJson(res, 400, { success: false, pinned: false, linkId: "", error: "linkId is required" });
				return;
			}

			const result = await forwardToggle(linkId);
			sendJson(res, result.success ? 200 : 503, result);
			return;
		}

		sendJson(res, 404, { error: "Not found" });
	} catch (error) {
		sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : "Server error" });
	}
});

const wss = new WebSocketServer({ server, path: "/extension" });

wss.on("connection", (socket) => {
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

			if (payload.type === "status") {
				pinnedLinkId = payload.pinnedLinkId ?? pinnedLinkId;
			}
		} catch {
			// Ignore malformed messages.
		}
	});

	socket.send(JSON.stringify({ type: "hello", pinnedLinkId }));
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`Live Pin bridge listening on http://127.0.0.1:${PORT}`);
});
