#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ManifestSchema } from '../agent/registry'

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: validate-manifest <manifest.json>')
    process.exit(1)
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const parsed = ManifestSchema.parse(data)
  console.log('OK:', parsed.id, parsed.version)
}

main()


