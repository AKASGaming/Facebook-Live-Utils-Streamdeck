import type { Device, KeyAction } from "@elgato/streamdeck";

import { refreshBridgeLinks } from "../api/bridge.js";
import { getMenuLink, getMenuPinnedLinkId, setMenuLinks, shortLinkName } from "../link-menu-state.js";
import type { PinLink } from "../types.js";
import type { MenuLinkItem } from "./menu-item.js";

let menuLinkItemController: MenuLinkItem | undefined;

export function setMenuLinkItemController(controller: MenuLinkItem): void {
	menuLinkItemController = controller;
}

export function getMenuProfileName(device: Device): string {
	const { columns, rows } = device.size;
	return columns * rows > 15 ? "menu-sdxl" : "menu-sd";
}

export async function loadMenuLinks(bridgeUrl: string): Promise<{ links: PinLink[]; pinnedLinkId: string | null }> {
	const status = await refreshBridgeLinks(bridgeUrl);
	setMenuLinks(status.links, status.pinnedLinkId);
	return status;
}

export async function populateMenuItems(links: PinLink[], pinnedLinkId: string | null): Promise<void> {
	setMenuLinks(links, pinnedLinkId);

	if (!menuLinkItemController) {
		return;
	}

	const updates: Promise<void>[] = [];

	for (const action of menuLinkItemController.actions) {
		if (!action.isKey()) {
			continue;
		}

		updates.push(updateMenuItemAction(action, pinnedLinkId));
	}

	await Promise.all(updates);
}

async function updateMenuItemAction(action: KeyAction, pinnedLinkId: string | null): Promise<void> {
	const settings = await action.getSettings<{ slot?: number }>();
	const slot = settings.slot ?? 0;
	const link = getMenuLink(slot);

	if (!link) {
		await action.setTitle("");
		return;
	}

	const pinned = link.id === pinnedLinkId;
	await action.setTitle(`${shortLinkName(link.name)}${pinned ? "\nPINNED" : ""}`);
}

export async function refreshVisibleMenuItem(action: KeyAction): Promise<void> {
	await updateMenuItemAction(action, getMenuPinnedLinkId());
}
