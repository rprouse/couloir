import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the sidebar and the map area', () => {
    render(<App />)
    expect(screen.getByRole('complementary')).toBeInTheDocument() // <aside>
    expect(screen.getByTestId('map-area')).toBeInTheDocument()
  })
})
