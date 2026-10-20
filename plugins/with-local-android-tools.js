const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

/** Optional local override; cloud builds retain their SDK/CMake selection. */
module.exports = function withLocalAndroidTools(config) {
  return withDangerousMod(config, ['android', async mod => {
    const cmake = process.env.ANIMALS_RUN_CMAKE_HOME;
    if (!cmake) return mod;
    if (!fs.existsSync(path.join(cmake, 'bin', process.platform === 'win32' ? 'cmake.exe' : 'cmake'))) {
      throw new Error('ANIMALS_RUN_CMAKE_HOME must point to an installed CMake directory.');
    }
    const file = path.join(mod.modRequest.platformProjectRoot, 'local.properties');
    const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const lines = previous.split(/\r?\n/).filter(line => !line.startsWith('cmake.dir=') && line.trim());
    lines.push(`cmake.dir=${cmake.replace(/\\/g, '/').replace(/:/g, '\\:')}`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    return mod;
  }]);
};
