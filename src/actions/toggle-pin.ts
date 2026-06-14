import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import {
	fetchBridgeStatus,
	findLink,
	getBridgeUrl,
	getConfiguredLinks,
	getGlobalSettings,
	syncLinksToBridge,
	togglePinnedLink,
} from "../api/bridge.js";
import type { PinLink, TogglePinSettings } from "../types.js";

type LinkOption = {
	label: string;
	value: string;
};

@action({ UUID: "com.ashton.livepin.toggle" })
export class TogglePinLink extends SingletonAction<TogglePinSettings> {
	override async onWillAppear(ev: WillAppearEvent<TogglePinSettings>): Promise<void> {
		await this.refreshActionDisplay(ev);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TogglePinSettings>): Promise<void> {
		await this.refreshActionDisplay(ev);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonObject, TogglePinSettings>): Promise<void> {
		const event = ev.payload.event;

		if (event === "getLinks") {
			const links = await this.resolveLinkOptions();
			await streamDeck.ui.sendToPropertyInspector({
				event: "getLinks",
				items: links.map((link) => ({
					label: link.label,
					value: link.value,
				})),
			});
		}
	}

	override async onKeyDown(ev: KeyDownEvent<TogglePinSettings>): Promise<void> {
		const linkId = ev.payload.settings.linkId;

		if (!linkId) {
			await ev.action.showAlert();
			await ev.action.setTitle("No link");
			return;
		}

		try {
			const bridgeUrl = await getBridgeUrl();
			const globalSettings = await getGlobalSettings();
			const links = getConfiguredLinks(globalSettings);
			const link = findLink(links, linkId);

			await syncLinksToBridge(bridgeUrl, links).catch(() => undefined);

			const result = await togglePinnedLink(bridgeUrl, linkId, link);

			if (!result.success) {
				throw new Error(result.error ?? "Toggle failed");
			}

			await this.updateActionState(ev, linkId, result.pinned);
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Toggle pin failed: ${error}`);
			await ev.action.showAlert();
			await ev.action.setTitle("Error");
		}
	}

	private async refreshActionDisplay(
		ev: WillAppearEvent<TogglePinSettings> | DidReceiveSettingsEvent<TogglePinSettings>,
	): Promise<void> {
		const linkId = ev.payload.settings.linkId;

		if (!linkId) {
			await ev.action.setTitle("Select link");
			return;
		}

		const globalSettings = await getGlobalSettings();
		const link = findLink(getConfiguredLinks(globalSettings), linkId);

		if (!link) {
			await ev.action.setTitle("Unknown");
			return;
		}

		try {
			const status = await fetchBridgeStatus(await getBridgeUrl());
			const pinned = status.pinnedLinkId === linkId;
			await this.updateActionState(ev, linkId, pinned, link.name);
		} catch {
			await ev.action.setTitle(this.shortName(link.name));
		}
	}

	private async updateActionState(
		ev: WillAppearEvent<TogglePinSettings> | DidReceiveSettingsEvent<TogglePinSettings> | KeyDownEvent<TogglePinSettings>,
		linkId: string,
		pinned: boolean,
		linkName?: string,
	): Promise<void> {
		const globalSettings = await getGlobalSettings();
		const link = findLink(getConfiguredLinks(globalSettings), linkId);
		const name = linkName ?? link?.name ?? "Link";

		await ev.action.setTitle(`${this.shortName(name)}\n${pinned ? "PINNED" : "OFF"}`);
	}

	private shortName(name: string): string {
		return name.length > 10 ? `${name.slice(0, 9)}…` : name;
	}

	private async resolveLinkOptions(): Promise<LinkOption[]> {
		const globalSettings = await getGlobalSettings();
		const configuredLinks = getConfiguredLinks(globalSettings);

		try {
			const status = await fetchBridgeStatus(await getBridgeUrl());
			const merged = new Map<string, PinLink>();

			for (const link of configuredLinks) {
				merged.set(link.id, link);
			}

			for (const link of status.links) {
				merged.set(link.id, {
					id: link.id,
					name: link.name,
					url: link.url,
					message: link.message,
				});
			}

			return [...merged.values()].map((link) => ({
				label: link.name,
				value: link.id,
			}));
		} catch {
			return configuredLinks.map((link) => ({
				label: link.name,
				value: link.id,
			}));
		}
	}
}
