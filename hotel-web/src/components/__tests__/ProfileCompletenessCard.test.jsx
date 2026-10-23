import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProfileCompletenessCard from '../ProfileCompletenessCard'

/** İleti role göre: aday işverenlere, işletme adaylara güven verir. */
describe('ProfileCompletenessCard ileti metni', () => {
  const data = (percentage) => ({ percentage, missing: [{ key: 'phone', label: 'Telefon' }] })

  it('varsayılan (aday): işverenlerden söz eder', () => {
    render(<ProfileCompletenessCard data={data(50)} />)
    expect(screen.getByText(/işverenlerde daha çok güven/)).toBeInTheDocument()
    expect(screen.queryByText(/adaylarda/)).not.toBeInTheDocument()
  })

  it('işletme: adaylardan söz eder, işverenlerden değil', () => {
    render(<ProfileCompletenessCard data={data(50)} audience="business" />)
    expect(screen.getByText(/adaylarda daha çok güven/)).toBeInTheDocument()
    expect(screen.queryByText(/işveren/)).not.toBeInTheDocument()
  })

  it('işletme düşük doluluk: başvurudan söz etmez', () => {
    render(<ProfileCompletenessCard data={data(20)} audience="business" />)
    expect(screen.getByText(/adaylar ilanına başvurmadan önce/)).toBeInTheDocument()
    expect(screen.queryByText(/Başvuruların/)).not.toBeInTheDocument()
  })

  it('yüzde ve eksik alanlar görünür', () => {
    render(<ProfileCompletenessCard data={data(50)} audience="business" />)
    expect(screen.getByText('%50')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('Telefon')).toBeInTheDocument()
  })
})
