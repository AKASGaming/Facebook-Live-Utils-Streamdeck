import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PLUGIN_DIR = "com.ashton.livepin.sdPlugin";

const PROFILES = [
	{ name: "menu-sd", columns: 5, rows: 3, deviceModel: "20GBA9901" },
	{ name: "menu-sdmini", columns: 3, rows: 2, deviceModel: "20GAI9501" },
	{ name: "menu-sdxl", columns: 8, rows: 4, deviceModel: "20GAT9902" },
	{ name: "menu-sdp", columns: 4, rows: 2, deviceModel: "10GBD9901" },
	{ name: "menu-sdneo", columns: 4, rows: 2, deviceModel: "20GBD9901" },
];

function randomPageId() {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let id = "";

	for (let index = 0; index < 26; index += 1) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}

	return id;
}

function gridPositions(columns, rows, skip = [{ column: 0, row: 0 }]) {
	const positions = [];

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			if (skip.some((entry) => entry.column === column && entry.row === row)) {
				continue;
			}

			positions.push({ column, row });
		}
	}

	return positions;
}

function textState(alignment = "bottom") {
	return [
		{
			FontFamily: "",
			FontSize: 9,
			FontStyle: "",
			FontUnderline: false,
			OutlineThickness: 2,
			ShowTitle: true,
			TitleAlignment: alignment,
			TitleColor: "#ffffff",
		},
	];
}

function pluginAction(name, uuid, settings = {}) {
	return {
		ActionID: randomUUID(),
		LinkedTitle: true,
		Name: name,
		Settings: settings,
		State: 0,
		States: textState(name === "Back" ? "middle" : "bottom"),
		UUID: uuid,
	};
}

function buildMenuActions(columns, rows) {
	const actions = {
		"0,0": pluginAction("Back", "com.ashton.livepin.menu-back"),
	};

	for (const [slot, position] of gridPositions(columns, rows).entries()) {
		actions[`${position.column},${position.row}`] = pluginAction("Pin Link Menu Item", "com.ashton.livepin.menu-item", {
			slot,
		});
	}

	return actions;
}

function packProfile(profileRoot, outputPath) {
	const folderName = profileRoot.split(/[/\\]/).pop();
	const zip = new AdmZip();

	function walk(dir, prefix) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			const zipPath = `${prefix}/${entry.name}`.replace(/\\/g, "/");

			if (entry.isDirectory()) {
				zip.addFile(`${zipPath}/`, Buffer.alloc(0));
				walk(full, zipPath);
				continue;
			}

			zip.addFile(zipPath, readFileSync(full));
		}
	}

	zip.addFile(`${folderName}/`, Buffer.alloc(0));
	walk(profileRoot, folderName);
	zip.writeZip(outputPath);
}

function validateProfile(outputPath, expectedSlots, profileName) {
	const zip = new AdmZip(outputPath);
	const extractDir = join(tmpdir(), `livepin-profile-validate-${randomUUID()}`);

	try {
		zip.extractAllTo(extractDir, true);
		const profileRoot = readdirSync(extractDir).find((name) => name.endsWith(".sdProfile"));

		if (!profileRoot) {
			throw new Error(`Missing .sdProfile folder in ${outputPath}`);
		}

		const rootManifest = JSON.parse(readFileSync(join(extractDir, profileRoot, "manifest.json"), "utf8"));
		const pageId = rootManifest.Pages?.Current;

		if (!pageId || !rootManifest.Pages.Pages?.includes(pageId)) {
			throw new Error(`Pages.Current (${pageId}) is not listed in Pages.Pages`);
		}

		const pageManifestPath = join(extractDir, profileRoot, "Profiles", pageId, "manifest.json");

		if (!statSync(pageManifestPath).isFile()) {
			throw new Error(`Missing page manifest for ${pageId}`);
		}

		const pageManifest = JSON.parse(readFileSync(pageManifestPath, "utf8"));
		const keypad = pageManifest.Controllers?.find((controller) => controller.Type === "Keypad");
		const actionCount = Object.keys(keypad?.Actions ?? {}).length;
		const expectedActions = expectedSlots + 1;

		if (actionCount !== expectedActions) {
			throw new Error(`Expected ${expectedActions} actions, found ${actionCount}`);
		}

		if (!keypad.Actions["0,0"] || keypad.Actions["0,0"].UUID !== "com.ashton.livepin.menu-back") {
			throw new Error("Back action missing from top-left key");
		}

		if (rootManifest.PreconfiguredName !== profileName) {
			throw new Error(`PreconfiguredName (${rootManifest.PreconfiguredName}) must match profile bundle name (${profileName})`);
		}

		if (rootManifest.Device?.UUID !== "") {
			throw new Error("Device.UUID must be an empty string in bundled profiles");
		}

		if (keypad.Actions["0,0"].Plugin) {
			throw new Error("Bundled actions must not include a Plugin block");
		}
	} finally {
		rmSync(extractDir, { recursive: true, force: true });
	}
}

function buildProfile({ name, columns, rows, deviceModel }) {
	const extractDir = join(tmpdir(), `livepin-profile-${randomUUID()}`);

	try {
		const profileId = randomUUID().toUpperCase();
		const profileRoot = join(extractDir, `${profileId}.sdProfile`);
		const pageId = randomPageId();
		const pageDir = join(profileRoot, "Profiles", pageId);

		mkdirSync(join(pageDir, "Images"), { recursive: true });

		const pageManifest = {
			Controllers: [
				{
					Type: "Keypad",
					Actions: buildMenuActions(columns, rows),
				},
			],
			Icon: "",
			Name: "",
		};

		writeFileSync(join(pageDir, "manifest.json"), JSON.stringify(pageManifest));

		const rootManifest = {
			Device: {
				Model: deviceModel,
				UUID: "",
			},
			Name: "Pin Links",
			PreconfiguredName: name,
			Pages: {
				Current: pageId,
				Pages: [pageId],
			},
			Version: "2.0",
		};

		writeFileSync(join(profileRoot, "manifest.json"), JSON.stringify(rootManifest));

		const outputPath = join(PLUGIN_DIR, `${name}.streamDeckProfile`);
		const linkSlots = columns * rows - 1;

		rmSync(outputPath, { force: true });
		packProfile(profileRoot, outputPath);
		validateProfile(outputPath, linkSlots, name);

		console.log(`Generated ${outputPath} (${linkSlots} link slots + back, ${deviceModel})`);
	} finally {
		rmSync(extractDir, { recursive: true, force: true });
	}
}

for (const profile of PROFILES) {
	buildProfile(profile);
}
