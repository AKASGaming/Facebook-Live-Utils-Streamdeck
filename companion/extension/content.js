const BRIDGE_WS = "ws://127.0.0.1:9742/extension";
const RECONNECT_MS = 2000;
const REFRESH_DEBOUNCE_MS = 400;

/** @type {WebSocket | null} */
let socket = null;

/** @type {number | null} */
let reconnectTimer = null;

/** @type {number | null} */
let refreshTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function linkIdFromUrl(url) {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.replace(/^www\./i, "");
		const path = parsed.pathname.replace(/\/$/, "");
		return `${host}${path}`;
	} catch {
		return url.trim();
	}
}

function urlsMatch(a, b) {
	return linkIdFromUrl(a) === linkIdFromUrl(b);
}

function extractUrlFromRoot(root) {
	const spans = root.querySelectorAll("span");

	for (const span of spans) {
		const text = span.textContent?.trim();

		if (text && /^https?:\/\//i.test(text)) {
			return text;
		}
	}

	return null;
}

function extractTitleFromRoot(root, url) {
	const spans = [...root.querySelectorAll("span")];

	for (const span of spans) {
		const text = span.textContent?.trim();

		if (!text || text === url || /^https?:\/\//i.test(text)) {
			continue;
		}

		if (text.length > 3 && text.length < 200) {
			return text;
		}
	}

	return url;
}

function findLinkRow(button) {
	let node = button;

	for (let depth = 0; depth < 12 && node; depth += 1) {
		const url = extractUrlFromRoot(node);

		if (url) {
			return { root: node, url };
		}

		node = node.parentElement;
	}

	return null;
}

function scrapeLiveLinks() {
	const links = [];
	const seen = new Set();
	const pinButtons = document.querySelectorAll('[aria-label="Pin"], [aria-label="Unpin"]');

	for (const button of pinButtons) {
		if (!(button instanceof HTMLElement)) {
			continue;
		}

		const row = findLinkRow(button);

		if (!row) {
			continue;
		}

		const url = row.url;
		const id = linkIdFromUrl(url);

		if (seen.has(id)) {
			continue;
		}

		seen.add(id);

		const label = button.getAttribute("aria-label") ?? "";
		const pinned = label.toLowerCase() === "unpin";

		links.push({
			id,
			name: extractTitleFromRoot(row.root, url),
			url,
			pinned,
		});
	}

	return links;
}

async function ensureLinksTabActive() {
	const tabs = document.querySelectorAll('[role="tab"]');

	for (const tab of tabs) {
		const text = tab.textContent ?? "";

		if (!/links\s*\(\d+\)/i.test(text) && !/^links$/i.test(text.trim())) {
			continue;
		}

		if (tab.getAttribute("aria-selected") !== "true") {
			if (tab instanceof HTMLElement) {
				tab.click();
				await sleep(600);
			}
		}

		return;
	}
}

function findLinkOnPage(linkId, urlHint) {
	const links = scrapeLiveLinks();

	return links.find((link) => link.id === linkId || (urlHint && urlsMatch(link.url, urlHint)));
}

async function clickPinButton(linkId, urlHint) {
	await ensureLinksTabActive();

	let link = findLinkOnPage(linkId, urlHint);

	if (!link) {
		await sleep(400);
		link = findLinkOnPage(linkId, urlHint);
	}

	if (!link) {
		throw new Error("Link not found in Live Producer. Open the Featured Links panel.");
	}

	const buttons = document.querySelectorAll('[aria-label="Pin"], [aria-label="Unpin"]');

	for (const button of buttons) {
		if (!(button instanceof HTMLElement)) {
			continue;
		}

		const row = findLinkRow(button);

		if (!row || !urlsMatch(row.url, link.url)) {
			continue;
		}

		button.click();
		await sleep(500);
		schedulePublishLinks();
		return link;
	}

	throw new Error("Pin button not found for link");
}

async function toggleLiveLink(linkId, urlHint) {
	await ensureLinksTabActive();

	let links = scrapeLiveLinks();
	let target = links.find((link) => link.id === linkId || (urlHint && urlsMatch(link.url, urlHint)));

	if (!target) {
		await sleep(400);
		links = scrapeLiveLinks();
		target = links.find((link) => link.id === linkId || (urlHint && urlsMatch(link.url, urlHint)));
	}

	if (!target) {
		throw new Error("Link not found in Live Producer. Open the Featured Links panel.");
	}

	if (target.pinned) {
		await clickPinButton(target.id, target.url);
		return { success: true, pinned: false, linkId: target.id };
	}

	const currentlyPinned = links.find((link) => link.pinned);

	if (currentlyPinned && currentlyPinned.id !== target.id) {
		await clickPinButton(currentlyPinned.id, currentlyPinned.url);
		await sleep(600);
	}

	await clickPinButton(target.id, target.url);

	return { success: true, pinned: true, linkId: target.id };
}

function publishLinks() {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		return;
	}

	const links = scrapeLiveLinks();
	const pinnedLink = links.find((link) => link.pinned);

	socket.send(
		JSON.stringify({
			type: "linksUpdated",
			links,
			pinnedLinkId: pinnedLink?.id ?? null,
		}),
	);
}

function schedulePublishLinks() {
	if (refreshTimer) {
		clearTimeout(refreshTimer);
	}

	refreshTimer = setTimeout(() => {
		refreshTimer = null;
		publishLinks();
	}, REFRESH_DEBOUNCE_MS);
}

function scheduleReconnect() {
	if (reconnectTimer) {
		return;
	}

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectBridge();
	}, RECONNECT_MS);
}

function connectBridge() {
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return;
	}

	if (socket) {
		socket.onopen = null;
		socket.onclose = null;
		socket.onerror = null;
		socket.onmessage = null;
	}

	socket = new WebSocket(BRIDGE_WS);

	socket.addEventListener("open", () => {
		console.log("[Live Pin] Connected to bridge");
		publishLinks();
	});

	socket.addEventListener("close", () => {
		console.log("[Live Pin] Disconnected from bridge");
		socket = null;
		scheduleReconnect();
	});

	socket.addEventListener("error", () => {
		socket?.close();
	});

	socket.addEventListener("message", async (event) => {
		let payload;

		try {
			payload = JSON.parse(event.data);
		} catch {
			return;
		}

		if (payload.type === "ping") {
			socket?.send(JSON.stringify({ type: "pong" }));
			return;
		}

		if (payload.type === "refreshLinks") {
			await ensureLinksTabActive();
			publishLinks();
			return;
		}

		if (payload.type !== "toggle") {
			return;
		}

		try {
			const result = await toggleLiveLink(payload.linkId, payload.link?.url);
			socket?.send(JSON.stringify({ requestId: payload.requestId, ...result }));
			schedulePublishLinks();
		} catch (error) {
			socket?.send(
				JSON.stringify({
					requestId: payload.requestId,
					success: false,
					pinned: false,
					error: error instanceof Error ? error.message : "Toggle failed",
				}),
			);
		}
	});
}

function watchFeaturedLinks() {
	const observer = new MutationObserver(() => {
		schedulePublishLinks();
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["aria-label", "aria-selected"],
	});

	window.addEventListener("focus", () => schedulePublishLinks());
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			schedulePublishLinks();
		}
	});
}

connectBridge();
watchFeaturedLinks();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type === "scrapeLinks") {
		ensureLinksTabActive()
			.then(() => {
				const links = scrapeLiveLinks();
				sendResponse({ links });
			})
			.catch((error) =>
				sendResponse({
					links: [],
					error: error instanceof Error ? error.message : "Scrape failed",
				}),
			);
		return true;
	}

	return undefined;
});
