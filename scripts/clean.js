const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(__dirname, '../output');

if (fs.existsSync(outputDir)) {
  for (const file of fs.readdirSync(outputDir)) {
    if (file === 'package.json') continue;
    fs.rmSync(path.join(outputDir, file), { recursive: true, force: true });
  }
}
