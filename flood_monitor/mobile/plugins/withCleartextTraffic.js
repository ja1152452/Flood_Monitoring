const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withCleartextTraffic = (config) => {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (manifest.application && manifest.application[0]) {
      manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
      manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`
      );
      return config;
    },
  ]);

  return config;
};

module.exports = withCleartextTraffic;
