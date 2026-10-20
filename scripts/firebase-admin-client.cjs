// Uses an already signed-in Firebase CLI; never reads or stores an app user's password.
const fs = require('node:fs');
const path = require('node:path');
function cliAuth() {
  const root = path.join(process.env.LOCALAPPDATA || path.join(require('node:os').homedir(), '.cache'), 'npm-cache', '_npx');
  for (const folder of fs.readdirSync(root)) {
    const file = path.join(root, folder, 'node_modules', 'firebase-tools', 'lib', 'auth.js');
    if (fs.existsSync(file)) return require(file);
  }
  throw new Error('Firebase CLI로 먼저 로그인해주세요.');
}
async function adminRest(pathname, method = 'GET', body) {
  const cli = cliAuth(), account = cli.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI 로그인이 필요해요.');
  const value = await cli.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/animalsrun-2571c/databases/(default)/documents${pathname.startsWith(':')?'':'/'}${pathname}`, { method, headers:{ Authorization:`Bearer ${value.access_token}`, 'Content-Type':'application/json' }, body:body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? `Firestore HTTP ${response.status}`);
  return result;
}
module.exports = { adminRest };
