const path = require('path');
const multer = require('multer');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Uploaded files live outside /frontend so redeploying the code never wipes them.
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'uploads');
const SERVICE_IMAGE_DIR = path.join(UPLOADS_ROOT, 'services');
const SERVICE_IMAGE_URL = '/uploads/services';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Files are held in memory so their real type can be checked before anything touches the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10, fieldSize: 64 * 1024 },
});

// Wraps multer so upload problems come back as the same JSON shape as every other error.
function uploadSingleImage(fieldName) {
  const handler = upload.single(fieldName);

  return (req, res, next) => {
    handler(req, res, (error) => {
      if (!error) return next();
      if (!(error instanceof multer.MulterError)) return next(error);

      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be 5 MB or smaller.'
          : 'The image could not be uploaded.';

      res.status(400).json({ message, errors: { image: message } });
    });
  };
}

module.exports = {
  UPLOADS_ROOT,
  SERVICE_IMAGE_DIR,
  SERVICE_IMAGE_URL,
  MAX_IMAGE_BYTES,
  uploadSingleImage,
};
