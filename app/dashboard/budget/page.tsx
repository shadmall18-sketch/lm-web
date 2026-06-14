'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const MONTH = new Date().toISOString().slice(0,7)

export default function BudgetPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [tab, setTab] = useState<'overview'|'transactions'|'bills'>('overview')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ type:'expense', amount:'', description:'', category_id:'', transaction_date: new Date().toISOString().split('T')[0] })

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const [{ data: t }, { data: c }, { data: b }] = await Promise.all([
      supabase.from('budget_transactions').select('*, category:budget_categories(*)').gte('transaction_date', `${MONTH}-01`).lte('transaction_date', `${MONTH}-31`).order('transaction_date', { ascending: false }),
      supabase.from('budget_categories').select('*').order('name'),
      supabase.from('bills').select('*').order('due_day'),
    ])
    setTransactions(t ?? []); setCategories(c ?? []); setBills(b ?? [])
  }

  useEffect(() => { load() }, [])

  const income = transactions.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0)
  const expenses = transactions.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0)

  const handleAdd = async () => {
    if (!form.amount) return
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    await supabase.from('budget_transactions').insert({ ...form, amount: parseFloat(form.amount), family_id: fid, entered_by: u.user!.id, category_id: form.category_id || null })
    setShowAdd(false); setForm({ type:'expense', amount:'', description:'', category_id:'', transaction_date: new Date().toISOString().split('T')[0] }); load()
  }

  const spendingByCategory = () => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type==='expense').forEach(t => { const n = t.category?.name ?? 'Uncategorized'; map[n] = (map[n]??0)+t.amount })
    return Object.entries(map).sort((a,b) => b[1]-a[1])
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Budget</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Entry</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{label:'Income',val:income,color:'#10B981'},{label:'Expenses',val:expenses,color:'#EF4444'},{label:'Net',val:income-expenses,color:income-expenses>=0?'#6366F1':'#EF4444'}].map(s => (
          <div key={s.label} className="bg-[#1E293B] rounded-xl p-4 border-l-4" style={{borderColor:s.color}}>
            <div className="text-xs text-[#64748B] uppercase font-semibold">{s.label}</div>
            <div className="text-xl font-black mt-1" style={{color:s.color}}>${s.val.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <div className="flex gap-2">
            {['expense','income'].map(t => (
              <button key={t} onClick={() => setForm(p=>({...p,type:t}))} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.type===t ? (t==='expense'?'bg-red-800 text-white':'bg-green-800 text-white') : 'bg-[#0F172A] text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
            ))}
          </div>
          <input value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))} placeholder="Amount" type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} placeholder="Description" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <select value={form.category_id} onChange={e => setForm(p=>({...p,category_id:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.transaction_date} onChange={e => setForm(p=>({...p,transaction_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex bg-[#1E293B] rounded-xl p-1 mb-6 border border-[#334155]">
        {(['overview','transactions','bills'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab===t ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {tab==='overview' && (
        <div className="space-y-3">
          {spendingByCategory().map(([name, amount]) => {
            const cat = categories.find(c => c.name===name)
            const pct = cat?.monthly_limit ? Math.min((amount/cat.monthly_limit)*100, 100) : null
            return (
              <div key={name} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold text-[#F1F5F9]">{name}</span>
                  <span className="text-[#94A3B8] text-sm">${amount.toFixed(2)}{cat?.monthly_limit ? ` / $${cat.monthly_limit}` : ''}</span>
                </div>
                {pct !== null && <div className="h-1.5 bg-[#334155] rounded-full"><div className="h-1.5 rounded-full transition-all" style={{width:`${pct}%`, backgroundColor: pct>90?'#EF4444':'#6366F1'}} /></div>}
              </div>
            )
          })}
          {transactions.length===0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No transactions this month yet</div>}
        </div>
      )}

      {tab==='transactions' && (
        <div className="space-y-2">
          {transactions.map(t => (
            <div key={t.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.type==='income'?'bg-green-400':'bg-red-400'}`} />
              <div className="flex-1">
                <div className="font-semibold text-[#F1F5F9] text-sm">{t.description || t.category?.name || 'Transaction'}</div>
                <div className="text-xs text-[#64748B]">{new Date(t.transaction_date).toLocaleDateString()}</div>
              </div>
              <span className={`font-bold text-sm ${t.type==='income'?'text-green-400':'text-red-400'}`}>{t.type==='income'?'+':'-'}${t.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {tab==='bills' && (
        <div className="space-y-2">
          {bills.map(b => (
            <div key={b.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#F1F5F9]">{b.name}</div>
                {b.due_day && <div className="text-sm text-[#64748B]">Due day {b.due_day}</div>}
              </div>
              <div className="flex items-center gap-3">
                {b.amount && <span className="font-bold text-[#F1F5F9]">${b.amount}</span>}
                {b.is_paid ? <span className="text-green-400 text-sm font-semibold">✅ Paid</span> : <span className="text-[#F59E0B] text-sm font-semibold">Unpaid</span>}
              </div>
            </div>
          ))}
          {bills.length===0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No bills added yet</div>}
        </div>
      )}
    </div>
  )
}
