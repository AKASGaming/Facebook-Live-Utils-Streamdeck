import streamDeck from "@elgato/streamdeck";

import type { BridgeStatus, GlobalSettings, PinLink, ToggleResult } from "../types.js";
import { DEFAULT_BRIDGE_URL } from "../types.js";

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

export async function fetchBridgeStatus(bridgeUrl: string): Promise<BridgeStatus> {
	const response = await fetch(`${normalizeBaseUrl(bridgeUrl)}/api/status`, {
		method: "GET",
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(5000),
	});

	if (!response.ok) {
		throw new Error(`Bridge returned ${response.status}`);
	}

	return (await response.json()) as BridgeStatus;
}

export async function togglePinnedLink(bridgeUrl: string, linkId: string, link?: PinLink): Promise<ToggleResult> {
	const response = await fetch(`${normalizeBaseUrl(bridgeUrl)}/api/toggle`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ linkId, link }),
		signal: AbortSignal.timeout(15000),
	});

	const payload = (await response.json()) as ToggleResult;

	if (!response.ok) {
		throw new Error(payload.error ?? `Bridge returned ${response.status}`);
	}

	return payload;
}

export async function syncLinksToBridge(bridgeUrl: string, links: PinLink[]): Promise<void> {
	const response = await fetch(`${normalizeBaseUrl(bridgeUrl)}/api/links/sync`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ links }),
		signal: AbortSignal.timeout(5000),
	});

	if (!response.ok) {
		throw new Error(`Bridge returned ${response.status}`);
	}
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	return settings ?? {};
}

export async function getBridgeUrl(): Promise<string> {
	const settings = await getGlobalSettings();
	return settings.bridgeUrl?.trim() || DEFAULT_BRIDGE_URL;
}

export function getConfiguredLinks(settings: GlobalSettings): PinLink[] {
	return settings.links ?? [];
}

export function findLink(links: PinLink[], linkId?: string): PinLink | undefined {
	if (!linkId) {
		return undefined;
	}

	return links.find((link) => link.id === linkId);
}
