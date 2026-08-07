const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to node_modules/.cache/puppeteer
  // so that the Chromium browser binary is bundled into deploy.zip
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
};
