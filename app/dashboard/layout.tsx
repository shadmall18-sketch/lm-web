'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: '📅' },
  { href: '/dashboard/chores', label: 'Chores', icon: '✅' },
  { href: '/dashboard/fitness', label: 'Fitness', icon: '💪' },
  { href: '/dashboard/budget', label: 'Budget', icon: '💰' },
  { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
  { href: '/dashboard/network', label: 'Family Network', icon: '🌐' },
  { href: '/dashboard/contacts', label: 'People', icon: '👥' },
  { href: '/dashboard/grocery', label: 'Grocery', icon: '🛒' },
  { href: '/dashboard/memories', label: 'Memories', icon: '📸' },
  { href: '/dashboard/members', label: 'Members', icon: '👨‍👩‍👧' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/'); return }
      const { data: profile } = await supabase.from('users').select('*, family:families(*)').eq('id', data.session.user.id).single()
      setUser(profile)
      setFamily(profile?.family)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-[#0F172A] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 w-64 h-full bg-[#1E293B] border-r border-[#334155] flex flex-col transition-transform duration-200`}>
        <div className="p-6 border-b border-[#334155]">
          <div className="text-3xl font-black text-[#6366F1]">LM</div>
          <div className="text-sm text-[#64748B] mt-1">{family?.name ?? 'Life Management'}</div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all
                ${pathname === item.href ? 'bg-[#6366F1] text-white' : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F1F5F9]'}`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#334155]">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-sm font-bold">
                {user.display_name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#F1F5F9] truncate">{user.display_name}</div>
                <div className="text-xs text-[#64748B]">{user.role}</div>
              </div>
              <div className="text-xs font-bold text-[#6366F1]">{user.points_balance}pts</div>
            </div>
          )}
          <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] rounded-lg hover:bg-[#0F172A] transition-all">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[#334155]">
          <button onClick={() => setMobileOpen(true)} className="text-[#F1F5F9] text-xl">☰</button>
          <div className="text-xl font-black text-[#6366F1]">LM</div>
          <div className="w-6" />
        </div>
        {children}
      </main>
    </div>
  )
}
