import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { getBridgeUrl } from "../api/bridge.js";
import { getMenuProfileName, loadMenuLinks, populateMenuItems } from "./menu-utils.js";

@action({ UUID: "com.ashton.livepin.menu" })
export class LinkMenu extends SingletonAction {
	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		await ev.action.setTitle("Links");
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const status = await loadMenuLinks(await getBridgeUrl());
			await populateMenuItems(status.links, status.pinnedLinkId);
			const profileName = getMenuProfileName(ev.action.device);
			streamDeck.logger.info(`Switching to menu profile: ${profileName} for device type ${ev.action.device.type}`);
			await streamDeck.profiles.switchToProfile(ev.action.device.id, profileName);
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Failed to open link menu: ${error}`);
			await ev.action.setTitle("Install profile");
			await ev.action.showAlert();
		}
	}
}
