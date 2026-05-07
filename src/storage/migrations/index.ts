import sql1 from './1.sql?raw'

export const SCHEMA_VERSION = 1

export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: sql1 },
]
