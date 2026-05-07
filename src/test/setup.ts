import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'

vi.mock('maplibre-gl', () => import('./mocks/maplibre-gl'))

afterEach(() => {
  cleanup()
})
