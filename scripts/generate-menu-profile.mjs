import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PLUGIN_DIR = "com.ashton.livepin.sdPlugin";
const TEMPLATE_DIR = "scripts/profile-templates";
const PLUGIN_VERSION = "0.1.0.0";

const PROFILES = [
	{ name: "menu-sd", template: "menu-sd.template", columns: 5, rows: 3, deviceModel: "20GBA9901", deviceName: "Stream Deck MK.2" },
	{ name: "menu-sdmini", template: "menu-sdmini.template", columns: 3, rows: 2, deviceModel: "20GBA9903", deviceName: "Stream Deck Mini" },
	{ name: "menu-sdxl", template: "menu-sdxl.template", columns: 8, rows: 4, deviceModel: "20GBA9911", deviceName: "Stream Deck XL" },
	{ name: "menu-sdp", template: "menu-sdp.template", columns: 4, rows: 2, deviceModel: "10GBD9901", deviceName: "Stream Deck +" },
	{ name: "menu-sdneo", template: "menu-sdneo.template", columns: 4, rows: 2, deviceModel: "20GBJ9901", deviceName: "Stream Deck Neo" },
];

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
		Plugin: {
			Name: name,
			UUID: uuid,
			Version: PLUGIN_VERSION,
		},
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

function findSdProfileRoot(extractDir) {
	const entry = readdirSync(extractDir).find((name) => name.endsWith(".sdProfile"));
	if (!entry) {
		throw new Error(`No .sdProfile folder found in ${extractDir}`);
	}

	return join(extractDir, entry);
}

function findMenuPageDir(profileRoot) {
	const pagesDir = join(profileRoot, "Profiles");
	const pageIds = readdirSync(pagesDir).filter((name) => statSync(join(pagesDir, name)).isDirectory());

	let bestPage = pageIds[0];
	let bestCount = -1;

	for (const pageId of pageIds) {
		const manifestPath = join(pagesDir, pageId, "manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		const keypad = manifest.Controllers?.find((controller) => controller.Type === "Keypad");
		const count = Object.keys(keypad?.Actions ?? {}).length;

		if (count > bestCount) {
			bestCount = count;
			bestPage = pageId;
		}
	}

	return join(pagesDir, bestPage);
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

function buildProfile({ name, template, columns, rows, deviceModel, deviceName }) {
	const templatePath = join(TEMPLATE_DIR, template);
	const extractDir = mkdtempSync(join(tmpdir(), "livepin-profile-"));

	try {
		const zip = new AdmZip(templatePath);
		zip.extractAllTo(extractDir, true);

		const profileRoot = findSdProfileRoot(extractDir);
		const pageDir = findMenuPageDir(profileRoot);
		const pageManifestPath = join(pageDir, "manifest.json");
		const pageManifest = JSON.parse(readFileSync(pageManifestPath, "utf8"));
		const menuActions = buildMenuActions(columns, rows);

		for (const controller of pageManifest.Controllers) {
			if (controller.Type === "Keypad") {
				controller.Actions = menuActions;
			}
		}

		writeFileSync(pageManifestPath, JSON.stringify(pageManifest));

		const rootManifestPath = join(profileRoot, "manifest.json");
		const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));

		rootManifest.Name = "Pin Links";
		rootManifest.Version = "3.0";
		rootManifest.Device = {
			Model: deviceModel,
			Name: deviceName,
			UUID: "00000000-0000-0000-0000-000000000000",
		};

		writeFileSync(rootManifestPath, JSON.stringify(rootManifest));

		const outputPath = join(PLUGIN_DIR, `${name}.streamDeckProfile`);
		rmSync(outputPath, { force: true });
		packProfile(profileRoot, outputPath);

		console.log(`Generated ${outputPath} (${columns * rows - 1} link slots, ${deviceModel})`);
	} finally {
		rmSync(extractDir, { recursive: true, force: true });
	}
}

for (const profile of PROFILES) {
	buildProfile(profile);
}
