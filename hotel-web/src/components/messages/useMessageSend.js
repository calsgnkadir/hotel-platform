/**
 * FAZ 20 — Mesaj gonderim motoru.
 *
 * MessageThread'de gonderimin 6 ayri kopyasi vardi (metin, dosya, pano,
 * ses kaydi, surukle-birak, arama daveti) ve her biri ayni ritueli elle
 * tekrarliyordu:
 *     appendMsg(msg) -> lastSeenId -> scroll -> onMessageSent()
 * Biri unutulursa (orn. drop'ta scroll) fark edilmesi zordu. Artik ritual
 * tek yerde: her primitif `finish(msg)` cagirir.
 *
 * Offline kuyruk da burada — kuyruga yazan (sendText) ve kuyrugu bosaltan
 * (drain effect) ayni concern; ayri dosyalarda durmalari icin sebep yok.
 *
 * Kullanim:
 *   const { sending, sendText, sendFile, sendFiles, sendCall } =
 *     useMessageSend({ conversation, onSent, onMessageSent })
 *
 *   onSent(msg)      — thread'e "yeni mesaj eklendi" (lastSeenId + scroll icin)
 *   onMessageSent()  — MessagesPage'e "sohbet listesini tazele"
 */
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import { keys } from '../../lib/queryClient'
import useWsConnected from '../../lib/useWsConnected'

export const MAX_FILE_BYTES = 15 * 1024 * 1024

export default function useMessageSend({ conversation, onSent, onMessageSent }) {
  const [sending, setSending] = useState(false)
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()

  const convId = conversation?.id
  const OFFLINE_QUEUE_KEY = `ajanshotel.offline-queue.${convId}`

  // Yeni mesajı cache'in başına ekle (optimistic update — anında UI'a yansır).
  // Backend page'i en yeniden eskiye sıralıyor: content[0] en yeni.
  function appendMsg(msg) {
    if (!convId) return
    queryClient.setQueryData(keys.conversations.messages(convId), (old) => {
      if (!old) return { content: [msg] }
      return { ...old, content: [msg, ...old.content] }
    })
  }

  /** Gonderim sonrasi ortak ritual — TEK yer. */
  function finish(msg) {
    appendMsg(msg)
    onSent?.(msg)
  }

  // ── Offline kuyruk ──
  function queueOffline(content, parentMessageId) {
    try {
      const q = JSON.parse(sessionStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
      q.push({ content, parentMessageId, at: Date.now() })
      sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q))
    } catch {}
  }

  useEffect(() => {
    if (!wsOk || !conversation) return
    // Baglanti geldi — kuyrugu drain et
    let cancelled = false
    async function drain() {
      let q = []
      try { q = JSON.parse(sessionStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') } catch {}
      if (q.length === 0) return
      sessionStorage.removeItem(OFFLINE_QUEUE_KEY)
      for (const item of q) {
        if (cancelled) return
        try {
          const msg = await hotelApi.sendMessage(convId, item.content, item.parentMessageId || null)
          finish(msg)
        } catch {
          queueOffline(item.content, item.parentMessageId)  // tekrar kuyrukla
          return
        }
      }
      toast.success(`${q.length} bekleyen mesaj gönderildi`)
      onMessageSent?.()
    }
    drain()
    return () => { cancelled = true }
  }, [wsOk, convId])

  /**
   * Metin gonder. Ag hatasi olursa kuyruga alir.
   * @returns 'sent' | 'queued' | 'failed' — composer draft'i 'failed' disinda temizler.
   */
  async function sendText(content, parentMessageId = null) {
    if (!content || sending) return 'failed'
    setSending(true)
    try {
      const msg = await hotelApi.sendMessage(convId, content, parentMessageId)
      finish(msg)
      onMessageSent?.()
      return 'sent'
    } catch (err) {
      const isNetwork = !err.response || err.code === 'ERR_NETWORK'
      if (isNetwork) {
        queueOffline(content, parentMessageId)
        toast('Bağlantı yok — mesaj kuyruğa alındı, bağlanınca gönderilecek', {
          icon: null, duration: 4000,
        })
        return 'queued'
      }
      toast.error(extractErrorMessage(err))
      return 'failed'
    } finally {
      setSending(false)
    }
  }

  /** Boyut siniri — asan dosya icin toast atar. */
  function isTooBig(file, withName = false) {
    if (file.size <= MAX_FILE_BYTES) return false
    toast.error(withName ? `${file.name} 15 MB'dan büyük — atlandı` : 'Dosya 15 MB\'dan büyük')
    return true
  }

  /** Tek dosya/ses gonder. @returns true = gonderildi */
  async function sendFile(file, caption = '') {
    if (!file || sending || isTooBig(file)) return false
    setSending(true)
    try {
      const msg = await hotelApi.sendMessageAttachment(convId, file, caption)
      finish(msg)
      onMessageSent?.()
      return true
    } catch (err) {
      toast.error(extractErrorMessage(err))
      return false
    } finally {
      setSending(false)
    }
  }

  /** Coklu dosya (surukle-birak). Sirayla — paralel server'i zorlar. */
  async function sendFiles(files) {
    if (sending) return
    const valid = files.filter(f => !isTooBig(f, true))
    if (valid.length === 0) return
    setSending(true)
    try {
      for (const file of valid) {
        try {
          const msg = await hotelApi.sendMessageAttachment(convId, file, '')
          finish(msg)
        } catch (err) {
          toast.error(`${file.name}: ${extractErrorMessage(err)}`)
        }
      }
      onMessageSent?.()
      if (valid.length > 1) toast.success(`${valid.length} dosya gönderildi`)
    } finally {
      setSending(false)
    }
  }

  /** Jitsi arama daveti gonder + davet edene aramayi ac. */
  async function sendCall(type) {
    if (sending) return
    // Rastgele room — tahmin edilemez, sohbet-bazlı isim
    const slug = `ajanshotel-${convId}-${Math.random().toString(36).slice(2, 10)}`
    const baseUrl = `https://meet.jit.si/${slug}`
    // Sesli arama için video muted
    const callUrl = type === 'audio' ? `${baseUrl}#config.startWithVideoMuted=true` : baseUrl
    setSending(true)
    try {
      const msg = await hotelApi.sendMessage(convId, `[CALL:${type}]${callUrl}`)
      finish(msg)
      onMessageSent?.()
      window.open(callUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return { sending, sendText, sendFile, sendFiles, sendCall }
}
