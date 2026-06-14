'use client'
import { createClient } from './supabase'

const VAPID_PUBLIC_KEY = 'BDIeoZYWKc0lfWrEb-CxxGVPK57dONER1vQf-m_c5Veg2gCNMuarAj9Tmuzqigqfp7bR7-r7us-CuZN6T7td7Q8'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushStatus(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!(await isPushSupported())) return 'unsupported'
  return Notification.permission as any
}

export async function subscribeToPush() {
  const supabase = createClient()
  if (!(await isPushSupported())) throw new Error('Push not supported on this device')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permission denied')

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const json = sub.toJSON()
  const { data: u } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()

  await supabase.from('push_subscriptions').upsert({
    user_id: u.user!.id,
    family_id: profile?.family_id,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  }, { onConflict: 'endpoint' })

  return true
}
