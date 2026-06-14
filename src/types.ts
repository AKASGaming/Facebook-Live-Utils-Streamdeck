export type PinLink = {
	id: string;
	name: string;
	url: string;
	message?: string;
};

export type GlobalSettings = {
	bridgeUrl?: string;
	links?: PinLink[];
};

export type TogglePinSettings = {
	linkId?: string;
};

export type BridgeLinkStatus = PinLink & {
	pinned: boolean;
};

export type BridgeStatus = {
	connected: boolean;
	pinnedLinkId: string | null;
	links: BridgeLinkStatus[];
};

export type ToggleResult = {
	success: boolean;
	pinned: boolean;
	linkId: string;
	error?: string;
};

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:9742";
