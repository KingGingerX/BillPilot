'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.cashmoto');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadCredentials() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveCredentials(creds) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function clearCredentials() {
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
}

function requireCredentials() {
  const creds = loadCredentials();
  if (!creds || !creds.api_key) {
    const chalk = require('chalk');
    console.error(chalk.red('✗ Not logged in. Run: cashmoto login'));
    process.exit(1);
  }
  return creds;
}

module.exports = { loadCredentials, saveCredentials, clearCredentials, requireCredentials };
