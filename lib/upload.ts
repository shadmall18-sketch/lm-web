'use client'
import { createClient } from './supabase'

export async function uploadMedia(file: File): Promise<{ url: string; type: 'image'|'video' } | null> {
  const supabase = createClient()
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`

  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) { console.error('upload error', error); return null }

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  const type: 'image'|'video' = file.type.startsWith('video') ? 'video' : 'image'
  return { url: data.publicUrl, type }
}
