'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import InstallPrompt from './InstallPrompt'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: '📅' },
  { href: '/dashboard/chores', label: 'Chores', icon: '✅' },
  { href: '/dashboard/fitness', label: 'Fitness', icon: '💪' },
  { href: '/dashboard/nutrition', label: 'Nutrition', icon: '🥗' },
  { href: '/dashboard/budget', label: 'Budget', icon: '💰' },
  { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
  { href: '/dashboard/network', label: 'Family Network', icon: '🌐' },
  { href: '/dashboard/contacts', label: 'People', icon: '👥' },
  { href: '/dashboard/about', label: 'About Me', icon: '🪪' },
  { href: '/dashboard/grocery', label: 'Grocery', icon: '🛒' },
  { href: '/dashboard/lists', label: 'Lists', icon: '🎁' },
  { href: '/dashboard/memories', label: 'Memories', icon: '📸' },
  { href: '/dashboard/members', label: 'Members', icon: '👨‍👩‍👧' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const supabase = createClient()

  const checkUnread = async (familyId: string, userId: string) => {
    const { data: read } = await supabase.from('message_reads').select('last_read_at').eq('user_id', userId).single()
    const lastRead = read?.last_read_at ?? '1970-01-01'
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .gt('created_at', lastRead)
      .neq('sent_by', userId)
    setUnread(count ?? 0)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/'); return }
      const { data: profile } = await supabase.from('users').select('*, family:families(*)').eq('id', data.session.user.id).single()
      setUser(profile)
      setFamily(profile?.family)
      if (profile?.family_id) checkUnread(profile.family_id, data.session.user.id)
    })
  }, [])

  // Clear unread when viewing messages; re-check on nav
  useEffect(() => {
    if (!user?.family_id) return
    if (pathname === '/dashboard/messages') {
      supabase.from('message_reads').upsert({ user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(() => setUnread(0))
    } else {
      checkUnread(user.family_id, user.id)
    }
  }, [pathname, user?.family_id])

  // Realtime: bump unread on new messages from others
  useEffect(() => {
    if (!family?.id || !user?.id) return
    const channel = supabase.channel(`nav-msgs:${family.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `family_id=eq.${family.id}` }, (payload: any) => {
        if (payload.new.sent_by !== user.id && pathname !== '/dashboard/messages') {
          setUnread(u => u + 1)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [family?.id, user?.id, pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-[#0A0F1E] overflow-hidden">

      {/* Sidebar */}
      <aside className={`
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 fixed md:relative z-40 h-full
        bg-[#0F172A] border-r border-[#1E293B] flex flex-col
        transition-all duration-200
        ${collapsed ? 'md:w-[68px]' : 'md:w-[220px]'}
        w-[220px]
      `}>
        {/* Logo + collapse */}
        <div className={`flex items-center border-b border-[#1E293B] h-[68px] px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div>
              <div className="text-2xl font-black text-[#6366F1] tracking-tight">LM</div>
              <div className="text-[10px] text-[#475569] font-semibold uppercase tracking-wide truncate max-w-[140px]">
                {family?.name ?? 'Life Management'}
              </div>
            </div>
          )}
          {collapsed && <div className="text-2xl font-black text-[#6366F1]">LM</div>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg border border-[#334155] text-[#64748B] hover:text-[#F1F5F9] hover:border-[#6366F1] transition-all text-xs"
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : ''}
              className={`flex items-center rounded-xl text-sm font-semibold transition-all
                ${collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'}
                ${pathname === item.href
                  ? 'bg-[#6366F1] text-white'
                  : 'text-[#64748B] hover:bg-[#1E293B] hover:text-[#F1F5F9]'
                }`}
            >
              <span className={collapsed ? 'text-xl relative' : 'text-base flex-shrink-0 relative'}>
                {item.icon}
                {item.href === '/dashboard/messages' && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  {item.label}
                  {item.href === '/dashboard/messages' && unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className={`border-t border-[#1E293B] p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {user && (
            <div className={`flex items-center gap-3 mb-2 ${collapsed ? 'justify-center' : 'px-1'}`}>
              <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user.display_name?.[0] ?? '?'}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#F1F5F9] truncate">{user.display_name}</div>
                  <div className="text-xs text-[#475569]">{user.role} · {user.points_balance}pts</div>
                </div>
              )}
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-xs text-[#64748B] hover:text-[#F1F5F9] rounded-lg hover:bg-[#1E293B] transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#0A0F1E]">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[#1E293B]">
          <button onClick={() => setMobileOpen(true)} className="text-[#F1F5F9] text-xl">☰</button>
          <div className="text-xl font-black text-[#6366F1]">LM</div>
          <div className="w-6" />
        </div>
        {children}
        <InstallPrompt />
      </main>
    </div>
  )
}
