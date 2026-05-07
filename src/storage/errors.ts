export class SchemaVersionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaVersionError'
  }
}

export class StorageNotInitializedError extends Error {
  constructor() {
    super('Storage provider has not been initialized. Call init() first.')
    this.name = 'StorageNotInitializedError'
  }
}
