'use strict';

const fs = require('fs');
const { getStatus, saveCredentials } = require('./credentials');

function isPlaywrightReady() {
  try {
    require.resolve('playwright');
    const { chromium } = require('playwright');
    const exePath = chromium.executablePath();
    return !!(exePath && fs.existsSync(exePath));
  } catch {
    return false;
  }
}

async function ensureAuth({ csrfRequired = true, refreshStale = false, forceRefresh = false } = {}) {
  const status = getStatus({ csrfRequired });
  if (status.ok && !forceRefresh && (!status.stale || !refreshStale)) {
    if (status.stale) {
      console.error('⚠ 凭据已超过 8 小时，本次先继续使用；如遇认证错误会自动刷新。');
    }
    return;
  }

  if (!isPlaywrightReady()) {
    if (!status.ok || forceRefresh) {
      const { AirpageError } = require('./errors');
      throw new AirpageError('凭据可能失效且无法自动刷新，请运行: node scripts/cli.js auth --browser');
    }
    console.error('⚠ 凭据已超过 8 小时，建议刷新: node scripts/cli.js auth --browser');
    return;
  }

  console.error(forceRefresh ? '凭据可能失效，正在自动刷新...' : '凭据已过期，正在自动刷新...');
  try {
    const { trySilent, PROFILE_DIR } = require('./auth-browser');
    const { chromium } = require('playwright');
    fs.mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });
    const result = await trySilent(chromium);
    if (result && result.cookie && (!csrfRequired || result.csrf)) {
      saveCredentials(result.cookie, result.csrf || '');
      console.error('✓ 凭据已自动刷新');
      return;
    }
    if (result && result.cookie && csrfRequired && !result.csrf) {
      console.error('⚠ 静默刷新拿到了 cookie，但未拿到 CSRF token。');
    }
  } catch {
    // Silent refresh failed
  }

  if (!status.ok || forceRefresh) {
    const { AirpageError } = require('./errors');
    throw new AirpageError('凭据无效且自动刷新失败，请运行: node scripts/cli.js auth --browser');
  }
  console.error('⚠ 静默刷新失败，凭据可能仍可用，如遇错误请运行: node scripts/cli.js auth --browser');
}

module.exports = { ensureAuth };
