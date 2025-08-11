import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const overrideDir = process.env.LOCAL_AGENT_CONFIG_DIR
const CONFIG_DIR = overrideDir ? path.resolve(overrideDir) : path.join(os.homedir(), '.local-agent')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

export type AppConfig = {
  defaultModel?: string
  retentionDays?: number
}

export function readConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as AppConfig
    }
  } catch {}
  return {}
}

export function writeConfig(cfg: AppConfig) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8')
  } catch {}
}

export function getDefaultModel(): string | undefined {
  return readConfig().defaultModel
}

export function setDefaultModel(model: string) {
  const cfg = readConfig()
  cfg.defaultModel = model
  writeConfig(cfg)
}

export function getRetentionDays(): number {
  const d = readConfig().retentionDays
  return typeof d === 'number' && d > 0 ? d : 14
}


