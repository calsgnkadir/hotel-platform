import { describe, it, expect } from 'vitest'
import { parseDocToken } from '../DocumentShare'

describe('parseDocToken', () => {
  it('belge istek kartini tanir', () => {
    expect(parseDocToken('[DOC_REQUEST:CRIMINAL_RECORD]'))
      .toEqual({ kind: 'request', type: 'CRIMINAL_RECORD' })
  })

  it('paylasilan belge kartini id ile tanir', () => {
    expect(parseDocToken('[DOC_SHARED:42:HEALTH_CERTIFICATE]'))
      .toEqual({ kind: 'shared', documentId: 42, type: 'HEALTH_CERTIFICATE' })
  })

  it('normal mesaj ya da yarim token kart degildir', () => {
    expect(parseDocToken('Merhaba')).toBeNull()
    expect(parseDocToken('[DOC_REQUEST:CRIMINAL_RECORD] ekstra')).toBeNull()
    expect(parseDocToken('[DOC_SHARED:abc:CV]')).toBeNull()
    expect(parseDocToken(null)).toBeNull()
  })
})
