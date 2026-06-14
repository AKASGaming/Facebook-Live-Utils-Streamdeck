const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeUrl(url) {
	try {
		const parsed = new URL(url);
		return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
	} catch {
		return url.trim();
	}
}

function textIncludesUrl(text, url) {
	const normalized = normalizeUrl(url);
	return text.includes(url) || text.includes(normalized);
}

function getCommentRoots() {
	return [...document.querySelectorAll('[role="article"], [data-testid*="comment"]')];
}

function findCommentByUrl(url) {
	const comments = getCommentRoots();

	for (const comment of comments) {
		const text = comment.textContent ?? "";

		if (textIncludesUrl(text, url)) {
			return comment;
		}
	}

	return null;
}

function findPinnedComment() {
	const comments = getCommentRoots();

	for (const comment of comments) {
		const text = (comment.textContent ?? "").toLowerCase();

		if (text.includes("pinned") || comment.querySelector('[aria-label*="Pinned"], [aria-label*="pinned"]')) {
			return comment;
		}
	}

	return null;
}

function clickByLabel(root, labels) {
	for (const label of labels) {
		const button = root.querySelector(`[aria-label="${label}"], [aria-label*="${label}"]`);

		if (button instanceof HTMLElement) {
			button.click();
			return true;
		}
	}

	const buttons = [...root.querySelectorAll("div[role='button'], span[role='button'], button")];

	for (const button of buttons) {
		const label = button.getAttribute("aria-label") ?? button.textContent ?? "";

		if (labels.some((candidate) => label.toLowerCase().includes(candidate.toLowerCase()))) {
			button.click();
			return true;
		}
	}

	return false;
}

async function openCommentMenu(comment) {
	comment.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
	await sleep(150);

	return clickByLabel(comment, ["More", "Actions for this comment", "Comment actions"]);
}

async function postComment(message) {
	const editable =
		document.querySelector('[contenteditable="true"][role="textbox"]') ??
		document.querySelector('[aria-label="Write a comment…"]') ??
		document.querySelector('[aria-label="Write a comment..."]');

	if (!(editable instanceof HTMLElement)) {
		throw new Error("Comment box not found");
	}

	editable.focus();
	editable.textContent = message;
	editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
	await sleep(200);

	const posted = clickByLabel(document, ["Comment", "Post", "Press Enter to post"]);

	if (!posted) {
		editable.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				key: "Enter",
				code: "Enter",
			}),
		);
	}

	await sleep(1500);
}

async function pinComment(comment) {
	await openCommentMenu(comment);
	await sleep(250);
	return clickByLabel(document, ["Pin", "Pin comment"]);
}

async function unpinComment(comment) {
	await openCommentMenu(comment);
	await sleep(250);
	return clickByLabel(document, ["Unpin", "Unpin comment"]);
}

async function toggleLink(link, currentPinnedLinkId) {
	const message = link.message?.trim() || link.url;
	const existing = findCommentByUrl(link.url);
	const pinned = currentPinnedLinkId === link.id;

	if (pinned) {
		const pinnedComment = existing ?? findPinnedComment();

		if (!pinnedComment) {
			throw new Error("Pinned comment not found");
		}

		if (!(await unpinComment(pinnedComment))) {
			throw new Error("Could not unpin comment");
		}

		return { success: true, pinned: false };
	}

	let target = existing;

	if (!target) {
		await postComment(message);
		target = findCommentByUrl(link.url);
	}

	if (!target) {
		throw new Error("Posted comment not found");
	}

	if (!(await pinComment(target))) {
		throw new Error("Could not pin comment");
	}

	return { success: true, pinned: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type !== "toggle") {
		return;
	}

	toggleLink(message.link, message.currentPinnedLinkId)
		.then((result) => sendResponse(result))
		.catch((error) =>
			sendResponse({
				success: false,
				pinned: message.currentPinnedLinkId === message.link.id,
				error: error instanceof Error ? error.message : "Toggle failed",
			}),
		);

	return true;
});
