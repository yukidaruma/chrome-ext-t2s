/* eslint-disable */

import { readdirSync } from 'fs';
import { join, basename } from 'path';
import sharp from 'sharp';

const ICON_SIZES = [32, 128, 512];
const ICONS_DIR = join(import.meta.dirname, 'icons');
const PUBLIC_DIR = join(import.meta.dirname, 'public');

async function convertSvgToPng(svgPath, outputPath, size) {
  try {
    await sharp(svgPath).resize(size, size).png().toFile(outputPath);

    console.log(`Converted ${basename(svgPath)} to ${size}x${size} PNG`);
  } catch (error) {
    console.error(`Failed to convert ${basename(svgPath)} to ${size}x${size}:`, error.message);
    throw error;
  }
}

// Get all SVG files
const svgFiles = readdirSync(ICONS_DIR)
  .filter(file => file.endsWith('.svg'))
  .map(file => join(ICONS_DIR, file));

if (svgFiles.length === 0) {
  console.log('No SVG files found in icons directory');
  process.exit(0);
}

// Convert each SVG to all required sizes
for (const svgPath of svgFiles) {
  const baseName = basename(svgPath, '.svg');

  for (const size of ICON_SIZES) {
    const outputPath = join(PUBLIC_DIR, `${baseName}-${size}.png`);
    await convertSvgToPng(svgPath, outputPath, size);
  }
}

console.log('All SVG files converted successfully');
