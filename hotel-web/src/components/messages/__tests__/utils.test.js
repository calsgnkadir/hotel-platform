import { describe, it, expect } from 'vitest'
import { parseCallInvite } from '../utils'

describe('parseCallInvite', () => {
  it('Jitsi davetlerini tanır (sesli arama #config parçası dahil)', () => {
    expect(parseCallInvite('[CALL:video]https://meet.jit.si/kadrom-7-abc123xy'))
      .toEqual({ type: 'video', url: 'https://meet.jit.si/kadrom-7-abc123xy' })
    expect(parseCallInvite('[CALL:audio]https://meet.jit.si/kadrom-7-abc#config.startWithVideoMuted=true'))
      .toEqual({ type: 'audio', url: 'https://meet.jit.si/kadrom-7-abc#config.startWithVideoMuted=true' })
  })

  it('Jitsi dışı adresler buton olmaz (null → düz metin)', () => {
    for (const bad of [
      '[CALL:video]https://evil.example/login',
      '[CALL:video]http://meet.jit.si/oda',
      '[CALL:video]https://meet.jit.si.evil.example/oda',
      '[CALL:video]https://meet.jit.si@evil.example/oda',
      '[CALL:video]https://meet.jit.si:8443/oda',
      '[CALL:video]javascript:alert(1)',
      '[CALL:video]https://meet.jit.si/',
      '[CALL:video]https://meet.jit.si/a/../../x',
      '[CALL:screen]https://meet.jit.si/oda',
      'merhaba https://meet.jit.si/oda',
      '',
      null,
    ]) {
      expect(parseCallInvite(bad)).toBeNull()
    }
  })
})
