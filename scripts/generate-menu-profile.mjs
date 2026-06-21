import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PLUGIN_DIR = "com.ashton.livepin.sdPlugin";

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

function menuItemAction(slot) {
	return {
		ActionID: randomUUID(),
		LinkedTitle: true,
		Name: "Pin Link Menu Item",
		Settings: { slot },
		State: 0,
		States: textState(),
		UUID: "com.ashton.livepin.menu-item",
	};
}

function backAction() {
	return {
		ActionID: randomUUID(),
		LinkedTitle: true,
		Name: "Back",
		Settings: {},
		State: 0,
		States: textState("middle"),
		UUID: "com.ashton.livepin.menu-back",
	};
}

function buildProfile({ name, columns, rows, deviceModel }) {
	const profileBundleId = randomUUID().toUpperCase();
	const pageId = randomUUID();
	const folderName = `${profileBundleId}.sdProfile`;
	const buildRoot = join(PLUGIN_DIR, ".profile-build", name);
	const profileRoot = join(buildRoot, folderName);
	const pageRoot = join(profileRoot, "Profiles", pageId);

	rmSync(buildRoot, { recursive: true, force: true });
	mkdirSync(join(pageRoot, "Images"), { recursive: true });

	const actions = {
		"0,0": backAction(),
	};

	for (const [slot, position] of gridPositions(columns, rows).entries()) {
		actions[`${position.column},${position.row}`] = menuItemAction(slot);
	}

	writeFileSync(
		join(pageRoot, "manifest.json"),
		JSON.stringify({
			Controllers: [{ Actions: actions, Type: "Keypad" }],
			Icon: "",
			Name: "",
		}),
	);

	writeFileSync(
		join(profileRoot, "manifest.json"),
		JSON.stringify({
			Device: { Model: deviceModel, UUID: "" },
			Name: "Pin Links",
			Pages: {
				Current: pageId,
				Default: pageId,
				Pages: [pageId],
			},
			Version: "2.0",
		}),
	);

	const zipPath = join(buildRoot, `${name}.zip`);
	const outputPath = join(PLUGIN_DIR, `${name}.streamDeckProfile`);

	rmSync(outputPath, { force: true });
	execSync(`powershell -NoProfile -Command "Compress-Archive -LiteralPath '${profileRoot}' -DestinationPath '${zipPath}' -Force"`);
	renameSync(zipPath, outputPath);
	rmSync(buildRoot, { recursive: true, force: true });

	console.log(`Generated ${outputPath} (${columns * rows - 1} link slots)`);
}

buildProfile({
	name: "menu-sd",
	columns: 5,
	rows: 3,
	deviceModel: "20GAA9901",
});

buildProfile({
	name: "menu-sdxl",
	columns: 8,
	rows: 4,
	deviceModel: "20GAT9901",
});
