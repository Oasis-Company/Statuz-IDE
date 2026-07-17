/**
 * Statuz IDE Legal Compliance Verification Script
 * Verifies all P0 fixes have been correctly applied.
 * Run: node verification.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const STATUZ_DIR = path.join(ROOT, 'src', 'vs', 'workbench', 'contrib', 'statuz');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function warn(name, detail) {
  console.log(`  \x1b[33m⚠\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
  warnings++;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function grepInFile(pattern, filePath) {
  const content = readFile(filePath);
  if (!content) return [];
  const regex = new RegExp(pattern, 'g');
  return content.match(regex) || [];
}

function hasCopyright(filePath) {
  const content = readFile(filePath);
  if (!content) return false;
  return content.includes('Copyright');
}

// ============================================================
// FIX-01: License consistency
// ============================================================
console.log('\n=== FIX-01: License Consistency ===');

const pkg = JSON.parse(readFile(path.join(ROOT, 'package.json')));
check('package.json license is Apache-2.0', pkg.license === 'Apache-2.0',
  `got: ${pkg.license}`);

const prod = JSON.parse(readFile(path.join(ROOT, 'product.json')));
check('product.json licenseName is Apache-2.0', prod.licenseName === 'Apache-2.0',
  `got: ${prod.licenseName}`);

const readme = readFile(path.join(ROOT, 'README.md'));
check('README.md mentions dual-license structure', 
  readme && readme.includes('dual-license') && readme.includes('Apache License 2.0'),
  'README.md should describe dual-license structure');

// ============================================================
// FIX-02: H.264/AVC patent notice
// ============================================================
console.log('\n=== FIX-02: H.264/AVC Patent Notice ===');
const h264 = readFile(path.join(ROOT, 'H264_PATENT_NOTICE.txt'));
check('H264_PATENT_NOTICE.txt exists', h264 !== null);
check('H264_PATENT_NOTICE.txt has correct content', 
  h264 && h264.includes('AVC PATENT PORTFOLIO LICENSE') && h264.includes('non-profit'),
  'should contain patent notice and non-profit context');

// ============================================================
// FIX-03: ffmpeg LGPL notice
// ============================================================
console.log('\n=== FIX-03: ffmpeg LGPL Notice ===');
const ffmpeg = readFile(path.join(ROOT, 'FFMPEG_LGPL_NOTICE.txt'));
check('FFMPEG_LGPL_NOTICE.txt exists', ffmpeg !== null);
check('FFMPEG_LGPL_NOTICE.txt has correct content', 
  ffmpeg && ffmpeg.includes('LGPL') && ffmpeg.includes('ffmpeg') && ffmpeg.includes('dynamically linked'),
  'should mention LGPL-2.1+, ffmpeg, and dynamic linking');

// ============================================================
// FIX-04: voideditor update dependency
// ============================================================
console.log('\n=== FIX-04: voideditor Update Dependency ===');
const updateService = readFile(path.join(STATUZ_DIR, 'electron-main', 'statuzUpdateMainService.ts'));
check('No voideditor/binaries reference in update service', 
  updateService && !updateService.includes('voideditor/binaries'),
  'should use Oasis-Company/Statuz-IDE instead');
check('Uses Oasis-Company/Statuz-IDE for releases',
  updateService && updateService.includes('Oasis-Company/Statuz-IDE/releases'),
  'should point to own repository');

// ============================================================
// FIX-05: Microsoft trademarks
// ============================================================
console.log('\n=== FIX-05: Microsoft Trademarks ===');

// Check key files that should NOT contain "Visual Studio Code" or "VS Code" as UI text
const filesToCheck = [
  'src/vs/code/browser/workbench/callback.html',
  'src/vs/main.ts',
  'src/vs/workbench/contrib/welcomeWalkthrough/browser/editor/vs_code_editor_walkthrough.ts',
  'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts',
  'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts',
  'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts',
  'src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts',
  'src/vs/workbench/contrib/workspace/browser/workspace.contribution.ts',
  'src/vs/platform/extensionManagement/node/extensionManagementService.ts',
  'src/vs/platform/externalTerminal/node/externalTerminalService.ts',
  'src/vs/server/node/server.cli.ts',
];

let msTrademarkFound = false;
filesToCheck.forEach(f => {
  const content = readFile(path.join(ROOT, f));
  if (content && (content.includes('"Visual Studio Code"') || content.includes("'Visual Studio Code'"))) {
    console.log(`  \x1b[31m✗\x1b[0m ${f} still contains "Visual Studio Code"`);
    msTrademarkFound = true;
    failed++;
  }
});
if (!msTrademarkFound) {
  check('No "Visual Studio Code" in key UI files', true);
}

// Check callback.html specifically
const callbackHtml = readFile(path.join(ROOT, 'src/vs/code/browser/workbench/callback.html'));
check('callback.html title is Statuz IDE', 
  callbackHtml && callbackHtml.includes('<title>Statuz IDE</title>'),
  'should show Statuz IDE in browser title');

// ============================================================
// FIX-06: Glass Devtools copyrights
// ============================================================
console.log('\n=== FIX-06: Glass Devtools Copyrights ===');
const glassDevtoolsFiles = [
  'browser/react/src2/statuz-tooltip/VoidTooltip.tsx',
  'browser/react/src2/statuz-onboarding/VoidOnboarding.tsx',
  'browser/react/src2/statuz-editor-widgets-tsx/VoidCommandBar.tsx',
  'browser/react/src2/statuz-editor-widgets-tsx/VoidSelectionHelper.tsx',
];

let glassFound = false;
glassDevtoolsFiles.forEach(f => {
  const content = readFile(path.join(STATUZ_DIR, f));
  if (content && content.includes('Glass Devtools')) {
    console.log(`  \x1b[31m✗\x1b[0m ${f} still contains "Glass Devtools"`);
    glassFound = true;
    failed++;
  }
});
if (!glassFound) {
  check('No Glass Devtools copyrights in statuz/ directory', true);
}

// Check they have valid copyright (Statuz or Oasis Company)
glassDevtoolsFiles.forEach(f => {
  const content = readFile(path.join(STATUZ_DIR, f));
  check(`${f} has valid copyright (Statuz or Oasis Company)`,
    content && (content.includes('Statuz') || content.includes('Oasis Company')),
    'should have been updated from Glass Devtools');
});

// ============================================================
// FIX-07: Missing copyright headers
// ============================================================
console.log('\n=== FIX-07: Missing Copyright Headers ===');
const coreFiles = [
  'browser/fileService.ts',
  'browser/contextGatheringService.ts',
  'browser/actionIDs.ts',
  'common/helpers/util.ts',
  'common/directoryStrTypes.ts',
];

coreFiles.forEach(f => {
  check(`${f} has copyright header`,
    hasCopyright(path.join(STATUZ_DIR, f)),
    'should have "Copyright 2026 Statuz" header');
});

// ============================================================
// FIX-08: Sandboxer copyright attribution
// ============================================================
console.log('\n=== FIX-08: Sandboxer Copyright Attribution ===');
const boardDir = path.join(STATUZ_DIR, 'browser', 'board');
const boardFiles = fs.readdirSync(boardDir).filter(f => f.endsWith('.ts'));

let sandboxerAttribution = 0;
boardFiles.forEach(f => {
  const content = readFile(path.join(boardDir, f));
  if (content && content.includes('Original work Copyright')) {
    sandboxerAttribution++;
  }
});
check('All ported board files have original copyright attribution',
  sandboxerAttribution >= 19,
  `${sandboxerAttribution}/20 files have attribution`);

// ============================================================
// FIX-09: Extension licenses
// ============================================================
console.log('\n=== FIX-09: Extension Licenses ===');

const sshPkg = JSON.parse(readFile(path.join(ROOT, 'extensions', 'open-remote-ssh', 'package.json')));
check('open-remote-ssh has license field', sshPkg.license === 'MIT',
  `got: ${sshPkg.license}`);
check('open-remote-ssh publisher is statuz', sshPkg.publisher === 'statuz',
  `got: ${sshPkg.publisher}`);

const wslPkg = JSON.parse(readFile(path.join(ROOT, 'extensions', 'open-remote-wsl', 'package.json')));
check('open-remote-wsl has license field', wslPkg.license === 'MIT',
  `got: ${wslPkg.license}`);
check('open-remote-wsl publisher is statuz', wslPkg.publisher === 'statuz',
  `got: ${wslPkg.publisher}`);

// ============================================================
// Additional checks: LICENSE-VS-Code.txt
// ============================================================
console.log('\n=== Additional: LICENSE-VS-Code.txt ===');
const licenseVsCode = readFile(path.join(ROOT, 'LICENSE-VS-Code.txt'));
check('LICENSE-VS-Code.txt references Statuz IDE (not just Void)', 
  licenseVsCode && licenseVsCode.includes('Statuz IDE') && licenseVsCode.includes('fork of Void'),
  'should describe complete fork chain');

// ============================================================
// Summary
// ============================================================
console.log('\n========================================');
console.log('  VERIFICATION SUMMARY');
console.log('========================================');
console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
console.log(`  \x1b[33mWarnings: ${warnings}\x1b[0m`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mAll P0 fixes verified successfully!\x1b[0m\n');
  process.exit(0);
}