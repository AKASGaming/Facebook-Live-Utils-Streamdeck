import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

@action({ UUID: "com.ashton.livepin.menu-back" })
export class MenuBack extends SingletonAction {
	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		await ev.action.setTitle("BACK");
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await streamDeck.profiles.switchToProfile(ev.action.device.id);
	}
}
