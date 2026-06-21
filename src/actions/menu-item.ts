import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { getBridgeUrl, togglePinnedLink } from "../api/bridge.js";
import { getMenuLink } from "../link-menu-state.js";
import { loadMenuLinks, populateMenuItems, refreshVisibleMenuItem } from "./menu-utils.js";

type MenuItemSettings = {
	slot?: number;
};

@action({ UUID: "com.ashton.livepin.menu-item" })
export class MenuLinkItem extends SingletonAction<MenuItemSettings> {
	override async onWillAppear(ev: WillAppearEvent<MenuItemSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		await refreshVisibleMenuItem(ev.action);
	}

	override async onKeyDown(ev: KeyDownEvent<MenuItemSettings>): Promise<void> {
		const slot = ev.payload.settings.slot ?? 0;
		const link = getMenuLink(slot);

		if (!link) {
			return;
		}

		try {
			const result = await togglePinnedLink(await getBridgeUrl(), link.id);

			if (!result.success) {
				throw new Error(result.error ?? "Toggle failed");
			}

			const status = await loadMenuLinks(await getBridgeUrl());
			await populateMenuItems(status.links, status.pinnedLinkId);
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Menu item toggle failed: ${error}`);
			await ev.action.showAlert();
		}
	}
}
