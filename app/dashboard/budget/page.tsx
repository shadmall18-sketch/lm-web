'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const MONTH = new Date().toISOString().slice(0,7)

// times per year + per month for each frequency
const FREQ: Record<string, { perYear: number; label: string }> = {
  weekly: { perYear: 52, label: 'Weekly' },
  monthly: { perYear: 12, label: 'Monthly' },
  yearly: { perYear: 1, label: 'Yearly' },
}

export default function BudgetPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [recurring, setRecurring] = useState<any[]>([])
  const [tab, setTab] = useState<'overview'|'transactions'|'recurring'>('overview')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddRec, setShowAddRec] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type:'expense', amount:'', description:'', category_id:'', transaction_date: new Date().toISOString().split('T')[0] })
  const [recForm, setRecForm] = useState({ type:'expense', amount:'', description:'', category_id:'', frequency:'monthly' })

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const [{ data: t }, { data: c }, { data: r }] = await Promise.all([
      supabase.from('budget_transactions').select('*, category:budget_categories(*)').gte('transaction_date', `${MONTH}-01`).lte('transaction_date', `${MONTH}-31`).order('transaction_date', { ascending: false }),
      supabase.from('budget_categories').select('*').order('name'),
      supabase.from('recurring_items').select('*, category:budget_categories(*)').eq('active', true).order('created_at', { ascending: false }),
    ])
    setTransactions(t ?? []); setCategories(c ?? []); setRecurring(r ?? [])
  }

  useEffect(() => { load() }, [])

  // This month's actual logged transactions
  const loggedIncome = transactions.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0)
  const loggedExpenses = transactions.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0)

  // Recurring monthly equivalents (perYear / 12)
  const recMonthly = (type: string) => recurring.filter(r => r.type===type).reduce((s,r) => s + (r.amount * FREQ[r.frequency].perYear / 12), 0)
  const recYearly = (type: string) => recurring.filter(r => r.type===type).reduce((s,r) => s + (r.amount * FREQ[r.frequency].perYear), 0)

  const monthlyRecIncome = recMonthly('income')
  const monthlyRecExpense = recMonthly('expense')
  const yearlyRecIncome = recYearly('income')
  const yearlyRecExpense = recYearly('expense')

  const handleAdd = async () => {
    if (!form.amount || saving) return
    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const fid = await getFamilyId()
      await supabase.from('budget_transactions').insert({ ...form, amount: parseFloat(form.amount), family_id: fid, entered_by: u.user!.id, category_id: form.category_id || null })
      setShowAdd(false); setForm({ type:'expense', amount:'', description:'', category_id:'', transaction_date: new Date().toISOString().split('T')[0] }); load()
    } finally { setSaving(false) }
  }

  const handleAddRec = async () => {
    if (!recForm.amount || saving) return
    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const fid = await getFamilyId()
      await supabase.from('recurring_items').insert({ ...recForm, amount: parseFloat(recForm.amount), family_id: fid, created_by: u.user!.id, category_id: recForm.category_id || null })
      setShowAddRec(false); setRecForm({ type:'expense', amount:'', description:'', category_id:'', frequency:'monthly' }); load()
    } finally { setSaving(false) }
  }

  const deleteRec = async (id: string) => {
    await supabase.from('recurring_items').delete().eq('id', id)
    load()
  }

  const spendingByCategory = () => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type==='expense').forEach(t => { const n = t.category?.name ?? 'Uncategorized'; map[n] = (map[n]??0)+t.amount })
    return Object.entries(map).sort((a,b) => b[1]-a[1])
  }

  // Projected month = logged + recurring; projected year = recurring*+ logged annualized roughly
  const projMonthIncome = loggedIncome + monthlyRecIncome
  const projMonthExpense = loggedExpenses + monthlyRecExpense
  const projYearIncome = yearlyRecIncome + loggedIncome * 12
  const projYearExpense = yearlyRecExpense + loggedExpenses * 12

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Budget</h1>
        <button onClick={() => { setShowAdd(!showAdd); setShowAddRec(false) }} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Entry</button>
      </div>

      {/* This month actuals */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        {[{label:'Income',val:loggedIncome,color:'#10B981'},{label:'Expenses',val:loggedExpenses,color:'#EF4444'},{label:'Net',val:loggedIncome-loggedExpenses,color:loggedIncome-loggedExpenses>=0?'#6366F1':'#EF4444'}].map(s => (
          <div key={s.label} className="bg-[#1E293B] rounded-xl p-4 border-l-4" style={{borderColor:s.color}}>
            <div className="text-xs text-[#64748B] uppercase font-semibold">{s.label} (logged)</div>
            <div className="text-xl font-black mt-1" style={{color:s.color}}>${s.val.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Projected with recurring */}
      {recurring.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Projected This Month</div>
            <div className="flex justify-between text-sm"><span className="text-[#10B981]">Income</span><span className="text-[#10B981] font-bold">${projMonthIncome.toFixed(0)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#EF4444]">Expenses</span><span className="text-[#EF4444] font-bold">${projMonthExpense.toFixed(0)}</span></div>
            <div className="flex justify-between text-sm border-t border-[#334155] mt-1 pt-1"><span className="text-[#94A3B8]">Net</span><span className="font-bold" style={{color: projMonthIncome-projMonthExpense>=0?'#6366F1':'#EF4444'}}>${(projMonthIncome-projMonthExpense).toFixed(0)}</span></div>
          </div>
          <div className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
            <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Projected This Year</div>
            <div className="flex justify-between text-sm"><span className="text-[#10B981]">Income</span><span className="text-[#10B981] font-bold">${projYearIncome.toFixed(0)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#EF4444]">Expenses</span><span className="text-[#EF4444] font-bold">${projYearExpense.toFixed(0)}</span></div>
            <div className="flex justify-between text-sm border-t border-[#334155] mt-1 pt-1"><span className="text-[#94A3B8]">Net</span><span className="font-bold" style={{color: projYearIncome-projYearExpense>=0?'#6366F1':'#EF4444'}}>${(projYearIncome-projYearExpense).toFixed(0)}</span></div>
          </div>
        </div>
      )}

      {/* Add one-time entry */}
      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <div className="flex gap-2">
            {['expense','income'].map(t => (
              <button key={t} onClick={() => setForm(p=>({...p,type:t}))} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.type===t ? (t==='expense'?'bg-red-800 text-white':'bg-green-800 text-white') : 'bg-[#0F172A] text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
            ))}
          </div>
          <input value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))} placeholder="Amount" type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} placeholder="Description (store, what for...)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <select value={form.category_id} onChange={e => setForm(p=>({...p,category_id:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.transaction_date} onChange={e => setForm(p=>({...p,transaction_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?'Saving...':'Save'}</button>
            <button onClick={() => setShowAdd(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex bg-[#1E293B] rounded-xl p-1 mb-6 border border-[#334155]">
        {(['overview','transactions','recurring'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab===t ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {tab==='overview' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Spending by Category</div>
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
          {transactions.length===0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No transactions yet</div>}
        </div>
      )}

      {tab==='recurring' && (
        <div>
          <button onClick={() => setShowAddRec(!showAddRec)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl mb-4">+ Recurring Item</button>

          {showAddRec && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-4 space-y-3">
              <div className="flex gap-2">
                {['expense','income'].map(t => (
                  <button key={t} onClick={() => setRecForm(p=>({...p,type:t}))} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${recForm.type===t ? (t==='expense'?'bg-red-800 text-white':'bg-green-800 text-white') : 'bg-[#0F172A] text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
                ))}
              </div>
              <input value={recForm.amount} onChange={e => setRecForm(p=>({...p,amount:e.target.value}))} placeholder="Amount" type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={recForm.description} onChange={e => setRecForm(p=>({...p,description:e.target.value}))} placeholder="Description (rent, paycheck, Netflix...)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <select value={recForm.frequency} onChange={e => setRecForm(p=>({...p,frequency:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                {Object.entries(FREQ).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={recForm.category_id} onChange={e => setRecForm(p=>({...p,category_id:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleAddRec} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?'Saving...':'Save'}</button>
                <button onClick={() => setShowAddRec(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {recurring.map(r => (
              <div key={r.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.type==='income'?'bg-green-400':'bg-red-400'}`} />
                <div className="flex-1">
                  <div className="font-semibold text-[#F1F5F9] text-sm">{r.description || r.category?.name || (r.type==='income'?'Income':'Expense')}</div>
                  <div className="text-xs text-[#64748B]">{FREQ[r.frequency].label} · ~${(r.amount * FREQ[r.frequency].perYear / 12).toFixed(0)}/mo</div>
                </div>
                <span className={`font-bold text-sm ${r.type==='income'?'text-green-400':'text-red-400'}`}>{r.type==='income'?'+':'-'}${r.amount.toFixed(2)}</span>
                <button onClick={() => deleteRec(r.id)} className="text-[#64748B] hover:text-red-400 text-sm">✕</button>
              </div>
            ))}
            {recurring.length===0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No recurring income or expenses yet. Add rent, paychecks, subscriptions, etc.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
