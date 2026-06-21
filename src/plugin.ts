import streamDeck from "@elgato/streamdeck";

import { LinkMenu } from "./actions/link-menu.js";
import { MenuBack } from "./actions/menu-back.js";
import { MenuLinkItem } from "./actions/menu-item.js";
import { setMenuLinkItemController } from "./actions/menu-utils.js";
import { TogglePinLink } from "./actions/toggle-pin.js";

const menuLinkItem = new MenuLinkItem();

setMenuLinkItemController(menuLinkItem);

streamDeck.actions.registerAction(new TogglePinLink());
streamDeck.actions.registerAction(new LinkMenu());
streamDeck.actions.registerAction(menuLinkItem);
streamDeck.actions.registerAction(new MenuBack());

streamDeck.connect();
