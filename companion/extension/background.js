const BRIDGE_HTTP = "http://127.0.0.1:9742";

const FACEBOOK_URLS = [
	"https://www.facebook.com/*",
	"https://facebook.com/*",
	"https://m.facebook.com/*",
	"https://business.facebook.com/*",
];

chrome.runtime.onInstalled.addListener(() => {
	chrome.alarms.create("bridge-health", { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
	chrome.alarms.create("bridge-health", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== "bridge-health") {
		return;
	}

	try {
		await fetch(`${BRIDGE_HTTP}/api/status`);
	} catch {
		// Bridge not running; content script will reconnect when available.
	}
});
