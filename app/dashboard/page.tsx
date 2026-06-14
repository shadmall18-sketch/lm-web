'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [chores, setChores] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
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
      const [{ data: myChores }, { data: todayEvents }] = await Promise.all([
        supabase.from('chores').select('*').eq('assigned_to', uid).eq('status', 'pending').limit(4),
        supabase.from('calendar_events').select('*').gte('start_time', `${today}T00:00:00`).lte('start_time', `${today}T23:59:59`).limit(4),
      ])
      setChores(myChores ?? [])
      setEvents(todayEvents ?? [])
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const quickLinks = [
    { href: '/dashboard/grocery', icon: '🛒', label: 'Grocery List' },
    { href: '/dashboard/contacts', icon: '👥', label: 'People' },
    { href: '/dashboard/memories', icon: '📸', label: 'Memories' },
    { href: '/dashboard/messages', icon: '💬', label: 'Messages' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">{greeting()}, {user?.display_name} 👋</h1>
          <p className="text-[#64748B] mt-1">{family?.name}</p>
        </div>
        <div className="bg-[#1E293B] rounded-xl px-4 py-3 text-center border border-[#334155]">
          <div className="text-2xl font-black text-[#6366F1]">{user?.points_balance ?? 0}</div>
          <div className="text-xs text-[#64748B]">points</div>
        </div>
      </div>

      {/* Family Members */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Family</h2>
        <div className="flex gap-4 flex-wrap">
          {members.map(m => (
            <div key={m.id} className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${m.is_child ? 'bg-[#7C3AED]' : 'bg-[#6366F1]'}`}>
                {m.display_name?.[0]}
              </div>
              <span className="text-xs text-[#94A3B8]">{m.display_name?.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Today's Events */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide">Today</h2>
            <Link href="/dashboard/calendar" className="text-xs text-[#6366F1] hover:underline">See all →</Link>
          </div>
          <div className="space-y-2">
            {events.length === 0
              ? <div className="bg-[#1E293B] rounded-xl p-4 text-[#475569] text-sm italic border border-[#334155]">Nothing scheduled today</div>
              : events.map(e => (
                <div key={e.id} className="bg-[#1E293B] rounded-xl p-4 flex items-center gap-3 border border-[#334155]">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color ?? '#6366F1' }} />
                  <div>
                    <div className="font-semibold text-[#F1F5F9] text-sm">{e.title}</div>
                    {e.location && <div className="text-xs text-[#64748B] mt-0.5">📍 {e.location}</div>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* My Chores */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide">My Chores</h2>
            <Link href="/dashboard/chores" className="text-xs text-[#6366F1] hover:underline">See all →</Link>
          </div>
          <div className="space-y-2">
            {chores.length === 0
              ? <div className="bg-[#1E293B] rounded-xl p-4 text-[#475569] text-sm italic border border-[#334155]">You're all caught up! 🎉</div>
              : chores.map(c => (
                <div key={c.id} className="bg-[#1E293B] rounded-xl p-4 flex items-center justify-between border border-[#334155]">
                  <div>
                    <div className="font-semibold text-[#F1F5F9] text-sm">{c.title}</div>
                    {c.due_date && <div className="text-xs text-[#64748B] mt-0.5">Due {new Date(c.due_date).toLocaleDateString()}</div>}
                  </div>
                  {c.points_value > 0 && <span className="text-xs font-bold text-[#A5B4FC] bg-[#312E81] px-2 py-1 rounded-lg">+{c.points_value} pts</span>}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map(item => (
            <Link key={item.href} href={item.href} className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 flex flex-col items-center gap-3 hover:border-[#6366F1] transition-all group">
              <span className="text-3xl">{item.icon}</span>
              <span className="text-sm font-semibold text-[#94A3B8] group-hover:text-[#F1F5F9]">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
