import { describe, it, expect } from 'vitest'
import { parseDocToken } from '../DocumentShare'

describe('parseDocToken', () => {
  it('paylasilan belge kartini id ile tanir', () => {
    expect(parseDocToken('[DOC_SHARED:42:HEALTH_CERTIFICATE]'))
      .toEqual({ documentId: 42, type: 'HEALTH_CERTIFICATE' })
  })

  it('normal mesaj, eski istek token i ya da bozuk token kart degildir', () => {
    expect(parseDocToken('Merhaba')).toBeNull()
    expect(parseDocToken('[DOC_REQUEST:CRIMINAL_RECORD]')).toBeNull()
    expect(parseDocToken('[DOC_SHARED:abc:CV]')).toBeNull()
    expect(parseDocToken(null)).toBeNull()
  })
})
