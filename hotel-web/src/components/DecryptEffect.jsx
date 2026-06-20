import { useEffect, useState } from 'react'

/**
 * DecryptEffect — hedef text'in harfleri rastgele karakterlerle başlar,
 * frame'ler ilerledikçe soldan sağa "decode" olur.
 *
 * Kullanım:
 *   <DecryptEffect text="Genel Bakış" active />
 * active=true iken animasyon koşar. active=false iken hedef text statik.
 *
 * Pragmatik kararlar:
 *  - active false → animasyon yok, doğrudan text render (CPU dostu)
 *  - Türkçe karakter seti dahil (ç ğ ı ö ş ü + büyük halleri)
 *  - Boşluk korunur (kelime arası belli olsun)
 *  - active false'a düşünce setText(text) → anında geri döner (kalıntı yok)
 */
const POOL =
  'abcdefghijklmnopqrstuvwxyzçğıöşü' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİÖŞÜ' +
  '0123456789'

export default function DecryptEffect({
  text,
  active = false,
  speed = 0.5,        // harf başına ilerleme hızı
  frameRate = 24,
}) {
  const [out, setOut] = useState(text)

  useEffect(() => {
    if (!active) {
      setOut(text)
      return
    }
    let iteration = 0
    let cancelled = false
    const tick = setInterval(() => {
      if (cancelled) return
      setOut(() => {
        let result = ''
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]
          if (ch === ' ') { result += ' '; continue }
          if (i < iteration) { result += ch; continue }
          result += POOL[Math.floor(Math.random() * POOL.length)]
        }
        iteration += speed
        if (iteration >= text.length) clearInterval(tick)
        return result
      })
    }, 1000 / frameRate)
    return () => { cancelled = true; clearInterval(tick) }
  }, [text, active, speed, frameRate])

  return <span style={{ display: 'inline-block' }}>{out}</span>
}
