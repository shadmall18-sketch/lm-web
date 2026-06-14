'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const MODULE_CARDS = [
  { href: '/dashboard/calendar', label: 'Calendar', icon: '📅', color: '#3B82F6', bg: '#1E3A5F' },
  { href: '/dashboard/chores', label: 'Chores', icon: '✅', color: '#10B981', bg: '#1E3A2F' },
  { href: '/dashboard/fitness', label: 'Fitness', icon: '💪', color: '#8B5CF6', bg: '#2E1B5E' },
  { href: '/dashboard/budget', label: 'Budget', icon: '💰', color: '#F59E0B', bg: '#3A2A0F' },
  { href: '/dashboard/messages', label: 'Messages', icon: '💬', color: '#6366F1', bg: '#1E1B4B' },
  { href: '/dashboard/grocery', label: 'Grocery', icon: '🛒', color: '#EC4899', bg: '#3B0F2A' },
  { href: '/dashboard/network', label: 'Family Network', icon: '🌐', color: '#14B8A6', bg: '#0F2E2B' },
  { href: '/dashboard/memories', label: 'Memories', icon: '📸', color: '#F97316', bg: '#3A1A0A' },
  { href: '/dashboard/contacts', label: 'People', icon: '👥', color: '#A78BFA', bg: '#2D1B69' },
]

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [chores, setChores] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, string>>({})
  const [hovered, setHovered] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) return
      const uid = session.session.user.id

      const [{ data: profile }, { data: fam }] = await Promise.all([
        supabase.from('users').select('*, family:families(*)').eq('id', uid).single(),
        supabase.from('users').select('*').order('is_child'),
      ])
      setUser(profile)
      setFamily(profile?.family)
      setMembers(fam ?? [])

      const today = new Date().toISOString().split('T')[0]
      const month = new Date().toISOString().slice(0, 7)

      const [
        { data: myChores },
        { data: todayEvents },
        { data: groceryItems },
        { data: pendingChores },
        { data: txns },
        { data: msgs },
      ] = await Promise.all([
        supabase.from('chores').select('*').eq('assigned_to', uid).eq('status', 'pending').limit(4),
        supabase.from('calendar_events').select('*').gte('start_time', `${today}T00:00:00`).lte('start_time', `${today}T23:59:59`).limit(4),
        supabase.from('grocery_list').select('*').eq('is_checked', false),
        supabase.from('chores').select('*').eq('status', 'pending'),
        supabase.from('budget_transactions').select('*').gte('transaction_date', `${month}-01`).lte('transaction_date', `${month}-31`),
        supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(1),
      ])

      setChores(myChores ?? [])
      setEvents(todayEvents ?? [])

      const expenses = (txns ?? []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0)

      setStats({
        calendar: `${(todayEvents ?? []).length} events today`,
        chores: `${(pendingChores ?? []).length} pending`,
        fitness: 'Track workouts',
        budget: `$${expenses.toFixed(0)} spent`,
        messages: msgs?.length ? 'New messages' : 'Family chat',
        grocery: `${(groceryItems ?? []).length} items`,
        network: 'Connected families',
        memories: 'Family timeline',
        contacts: 'People & gifts',
      })
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">{greeting()}, {user?.display_name} 👋</h1>
          <p className="text-[#475569] mt-1 text-sm">{todayFormatted} · Here's what's happening today</p>
        </div>
        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl px-5 py-3 text-center flex-shrink-0">
          <div className="text-2xl font-black text-[#6366F1]">{user?.points_balance ?? 0}</div>
          <div className="text-[10px] text-[#475569] font-bold uppercase tracking-wide mt-0.5">Family Pts</div>
        </div>
      </div>

      {/* Family Members */}
      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">Family</span>
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 bg-[#1E293B] border border-[#334155] rounded-full pl-1 pr-3 py-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${m.is_child ? 'bg-[#7C3AED]' : 'bg-[#6366F1]'}`}>
              {m.display_name?.[0]}
            </div>
            <div>
              <div className="text-xs font-semibold text-[#F1F5F9]">{m.display_name?.split(' ')[0]}</div>
              {m.points_balance > 0 && <div className="text-[10px] text-[#6366F1] font-bold">{m.points_balance} pts</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Module Cards — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {MODULE_CARDS.map(mod => (
          <Link
            key={mod.href}
            href={mod.href}
            onMouseEnter={() => setHovered(mod.href)}
            onMouseLeave={() => setHovered(null)}
            className="block rounded-2xl p-5 border transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: hovered === mod.href ? mod.bg : '#111827',
              borderColor: hovered === mod.href ? mod.color + '70' : '#1E293B',
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-3xl">{mod.icon}</span>
              <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: mod.color }} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>{mod.label}</div>
            <div className="text-xl font-black mb-1" style={{ color: mod.color }}>
              {stats[mod.href.split('/').pop() ?? ''] ?? '—'}
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Today's Events */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">Today's Schedule</div>
            <Link href="/dashboard/calendar" className="text-xs text-[#6366F1] hover:underline">View all →</Link>
          </div>
          {events.length === 0
            ? <div className="text-[#475569] text-sm italic">Nothing scheduled — enjoy your day!</div>
            : events.map(e => (
              <div key={e.id} className="flex items-center gap-3 mb-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: e.color ?? '#6366F1' }} />
                <div>
                  <div className="text-sm font-semibold text-[#F1F5F9]">{e.title}</div>
                  {e.location && <div className="text-xs text-[#475569]">📍 {e.location}</div>}
                </div>
              </div>
            ))
          }
        </div>

        {/* My Chores + Quick Actions */}
        <div className="space-y-4">
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">My Chores</div>
              <Link href="/dashboard/chores" className="text-xs text-[#6366F1] hover:underline">View all →</Link>
            </div>
            {chores.length === 0
              ? <div className="text-[#475569] text-sm italic">All caught up! 🎉</div>
              : chores.map(c => (
                <div key={c.id} className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-[#F1F5F9]">{c.title}</div>
                  {c.points_value > 0 && <span className="text-xs font-bold text-[#A5B4FC] bg-[#312E81] px-2 py-0.5 rounded-lg">+{c.points_value}</span>}
                </div>
              ))
            }
          </div>

          {/* Quick Actions */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5">
            <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-3">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Add to Grocery', icon: '🛒', href: '/dashboard/grocery' },
                { label: 'Log Workout', icon: '💪', href: '/dashboard/fitness' },
                { label: 'Add Chore', icon: '✅', href: '/dashboard/chores' },
                { label: 'New Memory', icon: '📸', href: '/dashboard/memories' },
              ].map(a => (
                <Link key={a.label} href={a.href} className="flex items-center gap-2 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-3 text-xs font-semibold text-[#94A3B8] hover:border-[#6366F1] hover:text-[#F1F5F9] transition-all">
                  <span className="text-base">{a.icon}</span>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
