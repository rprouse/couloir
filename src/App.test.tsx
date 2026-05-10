import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the sidebar and the map area', () => {
    render(<App />)
    // Disambiguate: Sidebar and DetailPanel are both <aside role="complementary">.
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByTestId('map-area')).toBeInTheDocument()
  })
})
