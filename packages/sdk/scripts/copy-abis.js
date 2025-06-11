/**
 * Script to copy ABIs from the EVM package to the SDK package.
 * This ensures the SDK can be used as a standalone package.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// List of ABIs needed by the SDK
const requiredAbis = {
  'ERC1967Proxy.json': '../../evm/artifacts/ERC1967Proxy.sol/ERC1967Proxy.json',
  'SafeModule.json': '../../evm/artifacts/SafeModule.sol/SafeModule.json',
  'ISafe.json': '../../evm/artifacts/ISafe.sol/ISafe.json',
}

// Destination directory for ABI files
const destDir = path.resolve(__dirname, '../src/lib/abis')

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
  console.log(`Created directory: ${destDir}`)
}

// Copy ABI files
let success = true

for (const [fileName, sourcePath] of Object.entries(requiredAbis)) {
  const fullSourcePath = path.resolve(__dirname, sourcePath)
  const fullDestPath = path.join(destDir, fileName)

  try {
    if (fs.existsSync(fullSourcePath)) {
      const abiFile = fs.readFileSync(fullSourcePath, 'utf8')
      const abiJson = JSON.parse(abiFile)

      const simplified = {
        abi: abiJson.abi,
        bytecode: abiJson.bytecode || { object: '' },
      }

      fs.writeFileSync(fullDestPath, JSON.stringify(simplified, null, 2))
      console.log(`✅ Successfully copied ${fileName} to SDK`)
    } else {
      console.error(`❌ Could not find source file: ${sourcePath}`)
      success = false
    }
  } catch (err) {
    console.error(`❌ Error processing ${fileName}: ${err.message}`)
    success = false
  }
}

// Add a version file to track ABI versions
if (success) {
  const versionInfo = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    abiFiles: Object.keys(requiredAbis),
  }

  fs.writeFileSync(path.join(destDir, 'version.json'), JSON.stringify(versionInfo, null, 2))

  console.log(`\n✨ All ABIs successfully copied to SDK. Version information added.`)
} else {
  console.error(`\n⚠️ Some ABIs could not be copied. The SDK may not function correctly.`)
  process.exit(1)
}
