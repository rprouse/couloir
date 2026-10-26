import sql1 from './1.sql?raw'
import sql2 from './2.sql?raw'

export const SCHEMA_VERSION = 2

export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: sql1 },
  { version: 2, sql: sql2 },
]
