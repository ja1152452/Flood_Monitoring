const Jimp = require('jimp');

const files = [
  'assets/adaptive-icon.png',
  'assets/icon.png',
  'assets/splash-icon.png',
  'assets/images/icon.png',
  'assets/images/logo.png',
  'assets/images/splash-icon.png'
];

async function fix() {
  for (let file of files) {
    try {
      console.log(`Processing ${file}...`);
      const image = await Jimp.read(file);
      await image.writeAsync(file);
      console.log(`Successfully converted ${file} to a valid PNG.`);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }
}

fix();
