import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A var(--x) that theme.css never defines resolves to nothing, and the
// browser silently drops the declaration (e.g. a transparent background).
// Variables set inline per element are listed explicitly.
const INLINE_VARS = new Set(['--tag-color', '--tag-text'])

function filesUnder(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return filesUnder(path, exts)
    return exts.some((e) => name.endsWith(e)) ? [path] : []
  })
}

describe('theme variables', () => {
  it('every var(--x) used in src is defined in theme.css', () => {
    const src = fileURLToPath(new URL('.', import.meta.url))
    const defined = new Set(
      [...readFileSync(join(src, 'theme.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    )
    const undefinedUses: string[] = []
    for (const file of filesUnder(src, ['.css', '.tsx'])) {
      for (const m of readFileSync(file, 'utf8').matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (!defined.has(m[1]) && !INLINE_VARS.has(m[1])) undefinedUses.push(`${file}: ${m[1]}`)
      }
    }
    expect(undefinedUses).toEqual([])
  })
})
