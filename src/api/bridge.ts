import streamDeck from "@elgato/streamdeck";

import type { BridgeStatus, GlobalSettings, PinLink, ToggleResult } from "../types.js";
import { DEFAULT_BRIDGE_URL } from "../types.js";

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

export async function fetchBridgeStatus(bridgeUrl: string, refresh = false): Promise<BridgeStatus> {
	const query = refresh ? "?refresh=1" : "";
	const response = await fetch(`${normalizeBaseUrl(bridgeUrl)}/api/status${query}`, {
		method: "GET",
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(refresh ? 12000 : 5000),
	});

	if (!response.ok) {
		throw new Error(`Bridge returned ${response.status}`);
	}

	return (await response.json()) as BridgeStatus;
}

export async function refreshBridgeLinks(bridgeUrl: string): Promise<BridgeStatus> {
	const response = await fetch(`${normalizeBaseUrl(bridgeUrl)}/api/links/refresh`, {
		method: "POST",
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(12000),
	});

	if (!response.ok) {
		throw new Error(`Bridge returned ${response.status}`);
	}

	return (await response.json()) as BridgeStatus;
}

export async function togglePinnedLink(bridgeUrl: string, linkId: string): Promise<ToggleResult> {
	const response = await fetch(`${normalizeBaseUrl(bridgeUrl)}/api/toggle`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ linkId }),
		signal: AbortSignal.timeout(15000),
	});

	const payload = (await response.json()) as ToggleResult;

	if (!response.ok) {
		throw new Error(payload.error ?? `Bridge returned ${response.status}`);
	}

	return payload;
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	return settings ?? {};
}

export async function getBridgeUrl(): Promise<string> {
	const settings = await getGlobalSettings();
	return settings.bridgeUrl?.trim() || DEFAULT_BRIDGE_URL;
}

export function findLink(links: PinLink[], linkId?: string): PinLink | undefined {
	if (!linkId) {
		return undefined;
	}

	return links.find((link) => link.id === linkId);
}
