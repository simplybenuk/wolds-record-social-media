import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertDecodedPng(png: Buffer, expectedWidth: number, expectedHeight: number) {
  if (png.length < 57 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("render_png_invalid");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = -1;
  let seenHeader = false;
  let seenData = false;
  let seenEnd = false;
  const compressed: Buffer[] = [];

  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error("render_png_truncated");
    const length = png.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > png.length) throw new Error("render_png_truncated");
    const type = png.toString("ascii", offset + 4, offset + 8);
    const typeAndData = png.subarray(offset + 4, offset + 8 + length);
    if (crc32(typeAndData) !== png.readUInt32BE(offset + 8 + length)) throw new Error("render_png_crc_invalid");
    const data = png.subarray(offset + 8, offset + 8 + length);

    if (!seenHeader) {
      if (type !== "IHDR" || length !== 13) throw new Error("render_png_header_invalid");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colourType = data[9]!;
      if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error("render_png_header_invalid");
      seenHeader = true;
    } else if (type === "IHDR") {
      throw new Error("render_png_header_invalid");
    } else if (type === "IDAT") {
      if (seenEnd || length === 0) throw new Error("render_png_data_invalid");
      seenData = true;
      compressed.push(data);
    } else if (type === "IEND") {
      if (!seenData || length !== 0) throw new Error("render_png_end_invalid");
      seenEnd = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  if (!seenHeader || !seenData || !seenEnd || offset !== png.length) throw new Error("render_png_truncated");
  if (width !== expectedWidth || height !== expectedHeight) throw new Error("render_dimensions_invalid");
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colourType];
  const allowedDepths = ({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] } as Record<number, number[]>)[colourType];
  if (!channels || !allowedDepths?.includes(bitDepth)) throw new Error("render_png_header_invalid");
  const rowBytes = Math.ceil(width * channels * bitDepth / 8);
  const expectedDecodedLength = (rowBytes + 1) * height;
  let decoded: Buffer;
  try {
    decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: expectedDecodedLength + 1 });
  } catch {
    throw new Error("render_png_data_invalid");
  }
  if (decoded.length !== expectedDecodedLength) throw new Error("render_png_data_invalid");
  for (let row = 0; row < height; row += 1) {
    if (decoded[row * (rowBytes + 1)]! > 4) throw new Error("render_png_filter_invalid");
  }
}

export function assertPngDimensions(mediaRoot: string, relativePath: string, width: number, height: number) {
  const root = resolve(mediaRoot);
  const absolute = resolve(root, relativePath);
  const escaped = relative(root, absolute);
  if (!relativePath || escaped.startsWith("..") || escaped === "" || Buffer.from(relativePath).includes(0)) throw new Error("render_path_invalid");
  if (!statSync(absolute).isFile()) throw new Error("render_file_missing");
  assertDecodedPng(readFileSync(absolute), width, height);
  return absolute;
}

export const assertPortraitPng = (mediaRoot: string, relativePath: string) =>
  assertPngDimensions(mediaRoot, relativePath, 1080, 1350);

export const assertLegacySquarePng = (mediaRoot: string, relativePath: string) =>
  assertPngDimensions(mediaRoot, relativePath, 1080, 1080);

export function assertCompletePortraitSet(mediaRoot: string, relativePaths: string[], expectedOrdinals: number[]) {
  if (relativePaths.length !== expectedOrdinals.length) throw new Error("render_set_incomplete");
  const parent = dirname(relativePaths[0] ?? "");
  if (!parent || relativePaths.some((path) => dirname(path) !== parent)) throw new Error("render_set_root_mismatch");
  relativePaths.forEach((path, index) => {
    if (!path.endsWith(`/${expectedOrdinals[index]}.png`)) throw new Error("render_set_ordinal_mismatch");
    assertPortraitPng(mediaRoot, path);
  });
  const expectedNames = expectedOrdinals.map((ordinal) => `${ordinal}.png`).sort();
  const actualNames = readdirSync(resolve(mediaRoot, parent)).filter((name) => name.endsWith(".png")).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) throw new Error("render_set_files_mismatch");
}
