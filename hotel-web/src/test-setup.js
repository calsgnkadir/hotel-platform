/**
 * FAZ 0/#4d — Vitest setup.
 * jest-dom matcher'larini ekler (toBeInTheDocument vs).
 * Browser API'leri (matchMedia, IntersectionObserver) jsdom'da yok — polyfill ediyoruz.
 */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// matchMedia (Framer Motion reducedMotion için)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// IntersectionObserver (Framer whileInView için)
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver

// ResizeObserver (Recharts ResponsiveContainer için)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver
