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
	refreshBridgeLinks,
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
			const links = await this.resolveLinkOptions(true);
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
			const result = await togglePinnedLink(await getBridgeUrl(), linkId);

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

		try {
			const status = await fetchBridgeStatus(await getBridgeUrl());
			const link = findLink(status.links, linkId);

			if (!link) {
				await ev.action.setTitle("Unknown");
				return;
			}

			const pinned = status.pinnedLinkId === linkId;
			await this.updateActionState(ev, linkId, pinned, link.name);
		} catch {
			await ev.action.setTitle("Offline");
		}
	}

	private async updateActionState(
		ev: WillAppearEvent<TogglePinSettings> | DidReceiveSettingsEvent<TogglePinSettings> | KeyDownEvent<TogglePinSettings>,
		linkId: string,
		pinned: boolean,
		linkName?: string,
	): Promise<void> {
		let name = linkName;

		if (!name) {
			try {
				const status = await fetchBridgeStatus(await getBridgeUrl());
				name = findLink(status.links, linkId)?.name ?? "Link";
			} catch {
				name = "Link";
			}
		}

		await ev.action.setTitle(`${this.shortName(name)}\n${pinned ? "PINNED" : "OFF"}`);
	}

	private shortName(name: string): string {
		return name.length > 10 ? `${name.slice(0, 9)}…` : name;
	}

	private async resolveLinkOptions(refresh = false): Promise<LinkOption[]> {
		const bridgeUrl = await getBridgeUrl();

		try {
			const status = refresh ? await refreshBridgeLinks(bridgeUrl) : await fetchBridgeStatus(bridgeUrl, true);

			return status.links.map((link: PinLink) => ({
				label: link.pinned ? `${link.name} (pinned)` : link.name,
				value: link.id,
			}));
		} catch (error) {
			streamDeck.logger.warn(`Failed to load links: ${error}`);
			return [];
		}
	}
}
