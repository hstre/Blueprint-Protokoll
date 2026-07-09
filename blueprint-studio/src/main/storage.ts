import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { AiSettings, Blueprint, BlueprintMeta } from '@shared/types'

/**
 * Local JSON storage under the OS user-data dir:
 *   <userData>/blueprints/<id>.json   — one file per blueprint (graph + snapshots + Δ-log)
 *   <userData>/settings.json          — AI settings
 * Writes are atomic (tmp + rename) so a crash never corrupts a blueprint.
 */

function dir(): string {
  return path.join(app.getPath('userData'), 'blueprints')
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dir(), { recursive: true })
}

export async function listBlueprints(): Promise<BlueprintMeta[]> {
  await ensureDir()
  const files = (await fs.readdir(dir())).filter((f) => f.endsWith('.json'))
  const metas: BlueprintMeta[] = []
  for (const f of files) {
    try {
      const bp = JSON.parse(await fs.readFile(path.join(dir(), f), 'utf-8')) as Blueprint
      metas.push({
        id: bp.id,
        title: bp.title,
        description: bp.description,
        status: bp.status,
        updatedAt: bp.updatedAt,
        nodeCount: bp.graph.nodes.length,
        openAttacks: bp.graph.attacks.filter((a) => a.responseState === 'open').length
      })
    } catch {
      // skip unreadable file, never crash the list
    }
  }
  return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadBlueprint(id: string): Promise<Blueprint | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir(), `${id}.json`), 'utf-8')) as Blueprint
  } catch {
    return null
  }
}

export async function saveBlueprint(bp: Blueprint): Promise<void> {
  await ensureDir()
  const file = path.join(dir(), `${bp.id}.json`)
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(bp, null, 1), 'utf-8')
  await fs.rename(tmp, file)
}

export async function deleteBlueprint(id: string): Promise<void> {
  await fs.rm(path.join(dir(), `${id}.json`), { force: true })
}

const DEFAULT_AI: AiSettings = { apiBaseUrl: '', apiKey: '', model: '' }

export async function loadSettings(): Promise<AiSettings> {
  try {
    const raw = await fs.readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf-8')
    return { ...DEFAULT_AI, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_AI
  }
}

export async function saveSettings(s: AiSettings): Promise<void> {
  await fs.writeFile(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(s, null, 1), 'utf-8')
}
