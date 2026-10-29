import sql1 from './1.sql?raw'
import sql2 from './2.sql?raw'
import sql3 from './3.sql?raw'
import sql4 from './4.sql?raw'

export const SCHEMA_VERSION = 4

export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: sql1 },
  { version: 2, sql: sql2 },
  { version: 3, sql: sql3 },
  { version: 4, sql: sql4 },
]
