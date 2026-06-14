import streamDeck from "@elgato/streamdeck";

import { TogglePinLink } from "./actions/toggle-pin.js";

streamDeck.actions.registerAction(new TogglePinLink());
streamDeck.connect();
