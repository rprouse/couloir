import { fitWithin } from './image'

describe('fitWithin', () => {
  it('leaves images within the cap untouched (never upscales)', () => {
    expect(fitWithin(800, 600, 4096)).toEqual({ width: 800, height: 600 })
  })
  it('scales landscape images by the long edge', () => {
    expect(fitWithin(6000, 4000, 4096)).toEqual({ width: 4096, height: 2731 })
  })
  it('scales portrait images by the long edge', () => {
    expect(fitWithin(3000, 4000, 128)).toEqual({ width: 96, height: 128 })
  })
  it('never returns a zero dimension', () => {
    expect(fitWithin(10000, 10, 128)).toEqual({ width: 128, height: 1 })
  })
})
