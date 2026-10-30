import { SYMBOL_PATHS } from './symbolPaths'

// Vendored Material Symbols used by the UI itself rather than offered as
// waypoint icons. Add the name here and to NAMES in
// scripts/fetch-material-symbols.mjs, then rerun the script.
export const UI_ICONS = ['delete', 'download', 'edit'] as const

export type UiIcon = (typeof UI_ICONS)[number]

export function uiIconPath(icon: UiIcon): string {
  return SYMBOL_PATHS[icon]
}
