import type { PinLink } from "./types.js";

let menuLinks: PinLink[] = [];
let menuPinnedLinkId: string | null = null;

export function setMenuLinks(links: PinLink[], pinnedLinkId: string | null): void {
	menuLinks = links;
	menuPinnedLinkId = pinnedLinkId;
}

export function getMenuLinks(): PinLink[] {
	return menuLinks;
}

export function getMenuPinnedLinkId(): string | null {
	return menuPinnedLinkId;
}

export function getMenuLink(slot: number): PinLink | undefined {
	return menuLinks[slot];
}

export function shortLinkName(name: string): string {
	if (name.length <= 12) {
		return name;
	}

	return `${name.slice(0, 11)}…`;
}
