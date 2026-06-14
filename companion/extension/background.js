const BRIDGE_HTTP = "http://127.0.0.1:9742";
const BRIDGE_WS = "ws://127.0.0.1:9742/extension";

/** @type {WebSocket | null} */
let socket = null;

/** @type {number | null} */
let reconnectTimer = null;

function connect() {
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return;
	}

	socket = new WebSocket(BRIDGE_WS);

	socket.addEventListener("open", () => {
		console.log("[Live Pin Bridge] Connected to bridge");
	});

	socket.addEventListener("close", () => {
		console.log("[Live Pin Bridge] Disconnected from bridge");
		scheduleReconnect();
	});

	socket.addEventListener("error", () => {
		scheduleReconnect();
	});

	socket.addEventListener("message", async (event) => {
		let payload;

		try {
			payload = JSON.parse(event.data);
		} catch {
			return;
		}

		if (payload.type !== "toggle") {
			return;
		}

		const tabs = await chrome.tabs.query({
			url: [
				"https://www.facebook.com/*",
				"https://facebook.com/*",
				"https://m.facebook.com/*",
			],
		});

		if (tabs.length === 0) {
			respond(payload.requestId, {
				success: false,
				pinned: false,
				error: "Open your live stream page in the browser",
			});
			return;
		}

		const targetTab = tabs.find((tab) => tab.url?.includes("/videos/") || tab.url?.includes("watch/live")) ?? tabs[0];

		try {
			const result = await chrome.tabs.sendMessage(targetTab.id, {
				type: "toggle",
				link: payload.link,
				currentPinnedLinkId: payload.currentPinnedLinkId,
			});

			respond(payload.requestId, result);
		} catch (error) {
			respond(payload.requestId, {
				success: false,
				pinned: false,
				error: error instanceof Error ? error.message : "Failed to reach content script",
			});
		}
	});
}

/**
 * @param {string} requestId
 * @param {{ success: boolean; pinned: boolean; error?: string }} result
 */
function respond(requestId, result) {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		return;
	}

	socket.send(
		JSON.stringify({
			requestId,
			...result,
		}),
	);
}

function scheduleReconnect() {
	if (reconnectTimer) {
		return;
	}

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, 3000);
}

connect();

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
