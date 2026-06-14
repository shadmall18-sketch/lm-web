'use client'
import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Already installed?
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    if (standalone) return

    // Dismissed recently?
    const dismissed = localStorage?.getItem('lm-install-dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    const ios = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
    setIsIOS(ios)

    // Android/desktop: capture native install prompt
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: just show instructions (no native prompt available)
    if (ios) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem('lm-install-dismissed', Date.now().toString()) } catch {}
  }

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      dismiss()
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-[#1E293B] border border-[#6366F1]/40 rounded-2xl p-4 shadow-2xl">
      <button onClick={dismiss} className="absolute top-3 right-3 text-[#64748B] hover:text-[#F1F5F9]">✕</button>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white font-black text-lg flex-shrink-0">LM</div>
        <div className="flex-1 pr-4">
          <div className="font-bold text-[#F1F5F9] text-sm mb-1">Install LM</div>
          {isIOS ? (
            <div className="text-xs text-[#94A3B8]">
              Tap the Share button <span className="inline-block">⬆️</span> below, then <span className="font-semibold text-[#F1F5F9]">"Add to Home Screen"</span> to install and get notifications.
            </div>
          ) : (
            <>
              <div className="text-xs text-[#94A3B8] mb-2">Add LM to your home screen for quick access and notifications.</div>
              <button onClick={install} className="bg-[#6366F1] text-white text-xs font-bold px-4 py-2 rounded-lg">Install App</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
