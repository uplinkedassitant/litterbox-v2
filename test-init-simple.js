#!/usr/bin/env node
/**
 * Minimal test - just verify the IDL loads correctly
 */
const fs = require("fs");
const path = require("path");

console.log("Loading IDL...");
const idlPath = path.join(__dirname, "target/idl/litterbox_v2.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

console.log("IDL loaded successfully!");
console.log("Program name:", idl.name);
console.log("Version:", idl.version);
console.log("Instructions:", idl.instructions.map(i => i.name).join(", "));
console.log("\nInitialize instruction accounts:");
idl.instructions.find(i => i.name === "initialize").accounts.forEach(acc => {
  console.log(`  - ${acc.name} (mut: ${acc.isMut}, signer: ${acc.isSigner})`);
});
