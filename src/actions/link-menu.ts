import streamDeck, { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

import { getBridgeUrl } from "../api/bridge.js";
import { getMenuProfileName, loadMenuLinks, populateMenuItems } from "./menu-utils.js";

@action({ UUID: "com.ashton.livepin.menu" })
export class LinkMenu extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const status = await loadMenuLinks(await getBridgeUrl());
			await populateMenuItems(status.links, status.pinnedLinkId);
			await streamDeck.profiles.switchToProfile(ev.action.device.id, getMenuProfileName(ev.action.device));
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Failed to open link menu: ${error}`);
			await ev.action.showAlert();
		}
	}
}
