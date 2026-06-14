import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = "com.ashton.livepin.sdPlugin/imgs";

const targets = [
	"plugin/marketplace",
	"plugin/category-icon",
	"actions/toggle-pin/icon",
	"actions/toggle-pin/key",
];

function crc32(buffer) {
	let crc = 0xffffffff;

	for (const byte of buffer) {
		crc ^= byte;

		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
		}
	}

	return (crc ^ 0xffffffff) >>> 0;
}

function createPng(width, height, rgba) {
	const rowSize = 1 + width * 4;
	const raw = Buffer.alloc(rowSize * height);

	for (let y = 0; y < height; y += 1) {
		const rowStart = y * rowSize;
		raw[rowStart] = 0;

		for (let x = 0; x < width; x += 1) {
			const pixelStart = rowStart + 1 + x * 4;
			raw[pixelStart] = rgba[0];
			raw[pixelStart + 1] = rgba[1];
			raw[pixelStart + 2] = rgba[2];
			raw[pixelStart + 3] = rgba[3];
		}
	}

	const compressed = zlib.deflateSync(raw);
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	function chunk(type, data) {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length, 0);
		const typeBuffer = Buffer.from(type);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
		return Buffer.concat([length, typeBuffer, data, crc]);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function writeIcon(relativePath, color) {
	const directory = path.dirname(path.join(root, relativePath));
	fs.mkdirSync(directory, { recursive: true });

	const png = createPng(72, 72, color);
	fs.writeFileSync(path.join(root, `${relativePath}.png`), png);
	fs.writeFileSync(path.join(root, `${relativePath}@2x.png`), createPng(144, 144, color));
}

for (const target of targets) {
	writeIcon(target, [52, 120, 246, 255]);
}

console.log("Generated Stream Deck icons.");
