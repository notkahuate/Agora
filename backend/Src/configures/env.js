const fs = require('fs');
const path = require('path');

let loadedEnvPath = null;

function loadEnv() {
  if (loadedEnvPath) return loadedEnvPath;

  const candidates = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend', '.env'),
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      loadedEnvPath = envPath;
      return envPath;
    }
  }

  require('dotenv').config();
  loadedEnvPath = 'process.env';
  return loadedEnvPath;
}

function getLoadedEnvPath() {
  return loadedEnvPath;
}

module.exports = {
  loadEnv,
  getLoadedEnvPath,
};
