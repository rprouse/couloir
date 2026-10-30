import { getMap } from '../../hooks/useMap'
import { atesAreaBounds } from '../../map/layers/atesLayerData'
import { useAtesAreasStore } from '../../store/atesAreas'
import { useUiStore } from '../../store/ui'
import { debug } from '../../utils/debug'
import { AtesImportError } from '../../utils/atesKml'
import { showToast } from '../import/importToast'
import type { AtesImportResult } from './atesImport'

const FIT_PADDING_PX = 40

export function atesImportMessage(result: AtesImportResult): string {
  const zones = result.area.geojson.features.filter((f) => f.properties.kind === 'zone').length
  const skipped = result.skipped > 0 ? `, ${result.skipped} skipped` : ''
  return `${result.replaced ? 'Updated' : 'Imported'} ${result.area.name} (${zones} zone${zones === 1 ? '' : 's'}${skipped}).`
}

/**
 * Import ATES KMZ files one at a time (from the Settings button or a drop on
 * the map), report every outcome in one toast, turn the ATES layer on, and
 * frame the last area imported.
 */
export async function runAtesImport(files: File[]): Promise<void> {
  const messages: string[] = []
  let last: AtesImportResult | null = null
  for (const file of files) {
    try {
      last = await useAtesAreasStore.getState().importFile(file)
      messages.push(atesImportMessage(last))
    } catch (err) {
      debug('ATES import failed', file.name, err)
      const reason = err instanceof AtesImportError ? err.message : `import failed (${String(err)})`
      messages.push(`${file.name}: ${reason}`)
    }
  }
  if (messages.length > 0) showToast(messages.join(' '), 6000)

  if (last) {
    useUiStore.getState().setAtesEnabled(true)
    const bounds = atesAreaBounds(last.area)
    const map = getMap()
    if (bounds && map) map.fitBounds(bounds, { padding: FIT_PADDING_PX })
  }
}
