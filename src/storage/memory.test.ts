import { InMemoryStorageProvider } from './memory'
import { storageContract } from './contract'

storageContract('InMemoryStorageProvider', {
  create: async () => new InMemoryStorageProvider(),
})
