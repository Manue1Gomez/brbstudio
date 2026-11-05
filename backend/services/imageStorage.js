const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { SERVICE_IMAGE_DIR, SERVICE_IMAGE_URL } = require('../config/upload');

// The file's first bytes tell its real format; the browser-reported type can be faked.
const FORMATS = [
  {
    extension: '.jpg',
    matches: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    extension: '.png',
    matches: (bytes) =>
      bytes.length > 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    extension: '.webp',
    matches: (bytes) =>
      bytes.length > 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP',
  },
];

function detectExtension(buffer) {
  return FORMATS.find((format) => format.matches(buffer))?.extension ?? null;
}

function isSupportedImage(buffer) {
  return detectExtension(buffer) !== null;
}

// Saves the image under a random name and returns the public URL path stored in the database.
async function saveServiceImage(buffer) {
  const filename = `${crypto.randomUUID()}${detectExtension(buffer)}`;

  await fs.mkdir(SERVICE_IMAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(SERVICE_IMAGE_DIR, filename), buffer);

  return `${SERVICE_IMAGE_URL}/${filename}`;
}

// Best-effort cleanup: a leftover file is harmless, so failures never break the request.
async function deleteServiceImage(imagePath) {
  if (!imagePath || !imagePath.startsWith(`${SERVICE_IMAGE_URL}/`)) return;

  try {
    await fs.unlink(path.join(SERVICE_IMAGE_DIR, path.basename(imagePath)));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not delete ${imagePath}: ${error.message}`);
  }
}

module.exports = { isSupportedImage, saveServiceImage, deleteServiceImage };
