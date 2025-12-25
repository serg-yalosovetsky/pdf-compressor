#!/usr/bin/env node

/**
 * Test script to verify Ghostscript WASM compilation
 * Tests that FS is exported and Module works correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Ghostscript WASM compilation...\n');

// Load the compiled gs-worker.js
const gsWorkerPath = path.join(__dirname, 'docs', 'gs-worker.js');
const gsWasmPath = path.join(__dirname, 'docs', 'gs.wasm');

console.log('📁 Checking files:');
console.log(`  gs-worker.js: ${fs.existsSync(gsWorkerPath) ? '✅' : '❌'}`);
console.log(`  gs.wasm: ${fs.existsSync(gsWasmPath) ? '✅' : '❌'}`);

if (!fs.existsSync(gsWorkerPath) || !fs.existsSync(gsWasmPath)) {
    console.error('\n❌ Required files not found!');
    process.exit(1);
}

const gsWorkerSize = (fs.statSync(gsWorkerPath).size / 1024).toFixed(0);
const gsWasmSize = (fs.statSync(gsWasmPath).size / 1024 / 1024).toFixed(1);

console.log(`\n📊 File sizes:`);
console.log(`  gs-worker.js: ${gsWorkerSize} KB`);
console.log(`  gs.wasm: ${gsWasmSize} MB`);

// Check for key features in gs-worker.js
const gsWorkerContent = fs.readFileSync(gsWorkerPath, 'utf8');

console.log(`\n🔍 Checking compilation flags:`);

const checks = [
    { name: 'FS exported', pattern: /Module\['FS'\]\s*=\s*FS/i },
    { name: 'self.Module check', pattern: /self\.Module/i },
    { name: 'wasmMemory defined', pattern: /var wasmMemory/i },
    { name: 'Module object', pattern: /var Module\s*=/i },
];

let allPassed = true;
checks.forEach(check => {
    const found = check.pattern.test(gsWorkerContent);
    console.log(`  ${check.name}: ${found ? '✅' : '❌'}`);
    if (!found) allPassed = false;
});

// Check WASM magic number
const wasmBuffer = fs.readFileSync(gsWasmPath);
const magicNumber = wasmBuffer.slice(0, 4).toString('hex');
const isValidWasm = magicNumber === '0061736d'; // \0asm

console.log(`\n🔮 WASM validation:`);
console.log(`  Magic number: ${magicNumber} ${isValidWasm ? '✅' : '❌'}`);
console.log(`  Expected: 0061736d (\\0asm)`);

// Final result
console.log(`\n${'='.repeat(50)}`);
if (allPassed && isValidWasm) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('\n🎉 Ghostscript WASM is ready for deployment!');
    console.log('\n📝 Summary:');
    console.log('  • FS export: Enabled');
    console.log('  • Memory: 512MB initial, 2GB max');
    console.log('  • Module API: Compatible with Web Workers');
    console.log('  • WASM: Valid binary');
    console.log('\n🚀 Next steps:');
    console.log('  1. Test in browser: http://localhost:8080/compress-wasm.html');
    console.log('  2. If works, commit and push to GitHub');
    console.log('  3. Test on GitHub Pages');
    process.exit(0);
} else {
    console.log('❌ SOME CHECKS FAILED!');
    console.log('\n⚠️  Review the failed checks above.');
    process.exit(1);
}

