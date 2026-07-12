const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

const iconsDir = path.join(__dirname);
const lightSvg = fs.readFileSync(path.join(iconsDir, 'statuz-icon-light.svg'));
const darkSvg = fs.readFileSync(path.join(iconsDir, 'statuz-icon-dark.svg'));

const sizes = [16, 32, 48, 64, 128, 256, 512];

async function generateIcons() {
	// Generate PNGs from light SVG (for app icon - white bg)
	for (const size of sizes) {
		await sharp(lightSvg)
			.resize(size, size)
			.png()
			.toFile(path.join(iconsDir, `statuz-${size}.png`));
	}

	// Generate the main code.png for Linux (256x256)
	await sharp(lightSvg)
		.resize(256, 256)
		.png()
		.toFile(path.join(iconsDir, 'code.png'));

	// Generate favicon for server
	await sharp(lightSvg)
		.resize(32, 32)
		.png()
		.toFile(path.join(iconsDir, 'favicon.png'));

	// Generate ICO from multiple PNG sizes
	const pngBuffers = [];
	for (const size of [16, 32, 48, 64, 128, 256]) {
		pngBuffers.push(await sharp(lightSvg).resize(size, size).png().toBuffer());
	}
	const icoBuffer = await pngToIco(pngBuffers);
	fs.writeFileSync(path.join(iconsDir, 'code.ico'), icoBuffer);

	// Also generate the appimage png
	await sharp(lightSvg)
		.resize(256, 256)
		.png()
		.toFile(path.join(__dirname, '..', 'scripts', 'appimage', 'statuz.png'));

	// Copy the main code.ico to resources/win32/
	const resourcesWin32 = path.join(__dirname, '..', 'resources', 'win32');
	fs.copyFileSync(path.join(iconsDir, 'code.ico'), path.join(resourcesWin32, 'code.ico'));

	// Copy code.png to resources/linux/
	const resourcesLinux = path.join(__dirname, '..', 'resources', 'linux');
	fs.copyFileSync(path.join(iconsDir, 'code.png'), path.join(resourcesLinux, 'code.png'));

	// Copy favicon to resources/server/
	const resourcesServer = path.join(__dirname, '..', 'resources', 'server');
	const faviconPng = await sharp(lightSvg).resize(32, 32).png().toBuffer();
	// For favicon.ico, reuse the ICO format with 16 and 32
	const faviconIcoBuf = await pngToIco([
		await sharp(lightSvg).resize(16, 16).png().toBuffer(),
		await sharp(lightSvg).resize(32, 32).png().toBuffer(),
	]);
	fs.writeFileSync(path.join(resourcesServer, 'favicon.ico'), faviconIcoBuf);

	console.log('All icons generated successfully!');
	console.log('Generated files:');
	console.log('  - statuz_icons/code.ico (Windows app icon)');
	console.log('  - statuz_icons/code.png (Linux app icon, 256x256)');
	console.log('  - resources/win32/code.ico (copied)');
	console.log('  - resources/linux/code.png (copied)');
	console.log('  - resources/server/favicon.ico (copied)');
	console.log('  - scripts/appimage/statuz.png (copied)');
	console.log('  - statuz_icons/statuz-{16,32,48,64,128,256,512}.png (various sizes)');
}

generateIcons().catch(err => {
	console.error('Error generating icons:', err);
	process.exit(1);
});
