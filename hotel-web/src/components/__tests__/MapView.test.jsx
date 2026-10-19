import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * E3 — Harita: açık tema döşeme (CARTO Voyager) + görünür atıf.
 * E4 — Adres arama backend üzerinden (GET /api/geo/search); yalnız "Ara"/Enter ile,
 *      yazarken istek yok; tarayıcı Nominatim'e doğrudan gitmez.
 */
const tileProps = vi.hoisted(() => ({ current: null }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: (p) => { tileProps.current = p; return null },
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({ invalidateSize: () => {} }),
  useMapEvents: () => null,
}))
const searchGeo = vi.fn()
vi.mock('../../api/hotel', () => ({ searchGeo: (...a) => searchGeo(...a) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import MapView, { geocodeAddress, TILE_URL } from '../MapView'
import BusinessLocationEditor from '../../pages/business/components/BusinessLocationEditor'

describe('MapView döşeme ve atıf', () => {
  it('açık tema döşeme (koyu dark_all değil) ve CARTO alanı', () => {
    render(<MapView position={[41.04, 29.0]} title="Deniz Otel" />)
    expect(tileProps.current.url).toBe(TILE_URL)
    expect(TILE_URL).toMatch(/^https:\/\/\{s\}\.basemaps\.cartocdn\.com\//)
    expect(TILE_URL).toContain('voyager')
    expect(TILE_URL).not.toContain('dark')
  })

  it('atıf açık: © OpenStreetMap katkıcıları, © CARTO', () => {
    render(<MapView district="Beşiktaş" />)
    const attr = screen.getByTestId('map-attribution')
    expect(attr).toHaveTextContent('© OpenStreetMap katkıcıları, © CARTO')
    expect(screen.getByRole('link', { name: 'OpenStreetMap katkıcıları' }))
      .toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
  })
})

describe('geocodeAddress (backend vekili)', () => {
  beforeEach(() => searchGeo.mockReset())

  it('3 karakterden kısa sorgu istek atmaz', async () => {
    expect(await geocodeAddress('ab')).toBeNull()
    expect(searchGeo).not.toHaveBeenCalled()
  })

  it('ilk sonucun koordinatını döner', async () => {
    searchGeo.mockResolvedValue([{ lat: '41.0430', lon: '29.0060', displayName: 'Beşiktaş' }, { lat: 1, lon: 2 }])
    expect(await geocodeAddress('Barbaros Bulvarı 10')).toEqual([41.043, 29.006])
    expect(searchGeo).toHaveBeenCalledWith('Barbaros Bulvarı 10')
  })

  it('sonuç yoksa null', async () => {
    searchGeo.mockResolvedValue([])
    expect(await geocodeAddress('bulunmayan sokak')).toBeNull()
  })

  it('doğrudan Nominatim çağrısı yok (fetch kullanılmaz)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    searchGeo.mockResolvedValue([])
    await geocodeAddress('Bağdat Caddesi 42')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('İşletme konum editörü: yalnız "Ara" eyleminde arama', () => {
  beforeEach(() => searchGeo.mockReset())

  function renderEditor(onChange = vi.fn()) {
    render(<BusinessLocationEditor district="Kadıköy" neighborhood="Moda" businessName="Kafe"
                                   address="" latitude={null} longitude={null} onChange={onChange} />)
    return onChange
  }

  it('yazarken istek gitmez', async () => {
    renderEditor()
    const input = screen.getByPlaceholderText(/Bağdat Caddesi/)
    fireEvent.change(input, { target: { value: 'Moda' } })
    fireEvent.change(input, { target: { value: 'Moda Caddesi' } })
    fireEvent.change(input, { target: { value: 'Moda Caddesi 12' } })
    await new Promise(r => setTimeout(r, 50))
    expect(searchGeo).not.toHaveBeenCalled()
  })

  it('"Ara" tıklanınca tek istek, sonuç koordinatı iletilir', async () => {
    searchGeo.mockResolvedValue([{ lat: 40.98, lon: 29.03, displayName: 'Moda' }])
    const onChange = renderEditor()
    fireEvent.change(screen.getByPlaceholderText(/Bağdat Caddesi/), { target: { value: 'Moda Caddesi 12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(40.98, 29.03))
    expect(searchGeo).toHaveBeenCalledTimes(1)
    expect(searchGeo.mock.calls[0][0]).toContain('Moda Caddesi 12')
  })

  it('Enter da aramayı başlatır', async () => {
    searchGeo.mockResolvedValue([])
    renderEditor()
    const input = screen.getByPlaceholderText(/Bağdat Caddesi/)
    fireEvent.change(input, { target: { value: 'Moda Caddesi 12' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(searchGeo).toHaveBeenCalledTimes(1))
  })
})
