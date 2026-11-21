import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  BudgetExpense,
  OutputLanguage,
  RoomType,
  ShoppingRecommendation,
} from '../types';
import { getUILabels } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Wallet,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ShoppingBag,
  Sparkles,
  FileDown,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

interface BudgetShoppingViewProps {
  language: OutputLanguage;
  expenses: BudgetExpense[];
  budgetTarget: number;
  savedRoomNames: string[];
  defaultRoomType: RoomType;
  aiShoppingEnabled: boolean;
  canExportPdf: boolean;
  onUpdateBudgetTarget: (target: number) => void;
  onAddExpense: (item: Omit<BudgetExpense, 'id' | 'createdAt'>) => Promise<void> | void;
  onTogglePurchased: (id: string) => Promise<void> | void;
  onDeleteExpense: (id: string) => Promise<void> | void;
  onShoppingQueryCompleted?: () => void;
  onOpenPricing?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const CATEGORIES: BudgetExpense['category'][] = [
  'Storage',
  'Furniture',
  'Decor',
  'Lighting',
  'DIY',
  'Cleaning',
];

export const BudgetShoppingView: React.FC<BudgetShoppingViewProps> = ({
  language,
  expenses,
  budgetTarget,
  savedRoomNames,
  defaultRoomType,
  aiShoppingEnabled,
  canExportPdf,
  onUpdateBudgetTarget,
  onAddExpense,
  onTogglePurchased,
  onDeleteExpense,
  onShoppingQueryCompleted,
  onOpenPricing,
  onDirtyChange,
}) => {
  const isBn = language === 'bn';
  const t = getUILabels(language);

  const [targetInput, setTargetInput] = useState<string>(String(budgetTarget || 150));
  const [filterCat, setFilterCat] = useState<'All' | BudgetExpense['category']>('All');

  // New Expense Draft
  const [title, setTitle] = useState('');
  const [roomName, setRoomName] = useState(savedRoomNames[0] || 'Living Room');
  const [category, setCategory] = useState<BudgetExpense['category']>('Storage');
  const [estimatedCost, setEstimatedCost] = useState('25');
  const [actualCost, setActualCost] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // AI Shopping Assistant State
  const [shopRoomType, setShopRoomType] = useState<RoomType>(defaultRoomType);
  const [shopBudget, setShopBudget] = useState<string>(String(budgetTarget || 120));
  const [shopWidth, setShopWidth] = useState<string>('12');
  const [shopLength, setShopLength] = useState<string>('10');
  const [shopUnit, setShopUnit] = useState<'ft' | 'm'>('ft');
  const [shopFocus, setShopFocus] = useState<string>('');
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopSummary, setShopSummary] = useState<string>('');
  const [recommendations, setRecommendations] = useState<ShoppingRecommendation[]>([]);
  const [addedRecNames, setAddedRecNames] = useState<Record<string, boolean>>({});
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    setTargetInput(String(budgetTarget || 150));
  }, [budgetTarget]);

  useEffect(() => {
    onDirtyChange?.(title.trim().length > 0 || notes.trim().length > 0);
  }, [title, notes, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  const totals = useMemo(() => {
    const planned = expenses.reduce((sum, e) => sum + (Number(e.estimatedCost) || 0), 0);
    const spent = expenses
      .filter((e) => e.purchased)
      .reduce((sum, e) => sum + (Number(e.actualCost || e.estimatedCost) || 0), 0);
    const target = Math.max(0, Number(budgetTarget) || 0);
    const remaining = target - spent;
    return { planned, spent, target, remaining };
  }, [expenses, budgetTarget]);

  const filteredExpenses = useMemo(
    () => (filterCat === 'All' ? expenses : expenses.filter((e) => e.category === filterCat)),
    [expenses, filterCat]
  );

  const handleSaveTarget = () => {
    const val = Math.max(0, Math.min(500000, Math.round(Number(targetInput) || 0)));
    onUpdateBudgetTarget(val);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const est = Math.max(0, Number(estimatedCost) || 0);
    const act = actualCost.trim() ? Math.max(0, Number(actualCost) || 0) : est;
    await onAddExpense({
      title: title.trim(),
      roomName: roomName.trim() || 'Home',
      category,
      estimatedCost: est,
      actualCost: act,
      purchased: false,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setEstimatedCost('25');
    setActualCost('');
    setNotes('');
  };

  const handleRunShoppingAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiShoppingEnabled) {
      setShopError(
        isBn
          ? 'অ্যাডমিন বর্তমানে AI শপিং অ্যাসিস্ট্যান্ট সাময়িকভাবে বন্ধ রেখেছেন।'
          : 'AI Shopping Assistant is currently disabled by the platform administrator.'
      );
      return;
    }

    setShopLoading(true);
    setShopError(null);
    try {
      const resp = await fetch('/api/shopping-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: shopRoomType,
          budget: Math.max(10, Number(shopBudget) || 100),
          currency: 'USD',
          roomWidth: Math.max(3, Number(shopWidth) || 12),
          roomLength: Math.max(3, Number(shopLength) || 10),
          unit: shopUnit,
          focusNeed: shopFocus.trim(),
          language,
        }),
      });
      const text = await resp.text();
      const data = JSON.parse(text);
      if (!resp.ok || !data.success) {
        throw new Error(data.details || data.error || 'Unable to generate recommendations.');
      }
      setShopSummary(data.budgetStrategySummary || '');
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      onShoppingQueryCompleted?.();
    } catch (err: any) {
      setShopError(err?.message || 'Error fetching shopping guidance.');
    } finally {
      setShopLoading(false);
    }
  };

  const handleAddRecommendationToBudget = async (rec: ShoppingRecommendation) => {
    const nums = rec.estimatedCostRange.match(/\d+/g)?.map(Number) || [];
    const midpoint =
      nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : nums[0] || 20;
    const mappedCat: BudgetExpense['category'] = CATEGORIES.includes(
      rec.category as BudgetExpense['category']
    )
      ? (rec.category as BudgetExpense['category'])
      : 'Storage';

    await onAddExpense({
      title: rec.name,
      roomName: t.roomLabels[shopRoomType] || 'Room',
      category: mappedCat,
      estimatedCost: midpoint,
      actualCost: midpoint,
      purchased: false,
      notes: `Size: ${rec.idealDimensions}. DIY option: ${rec.diyAlternative}`,
    });
    setAddedRecNames((prev) => ({ ...prev, [rec.name]: true }));
  };

  const handleExportCsv = () => {
    const header = ['Title', 'Room', 'Category', 'Estimated Cost', 'Actual Cost', 'Purchased', 'Notes'];
    const rows = expenses.map((e) => [
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.roomName.replace(/"/g, '""')}"`,
      e.category,
      e.estimatedCost,
      e.actualCost,
      e.purchased ? 'Yes' : 'No',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neatspace-budget-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!canExportPdf) {
      setExportNotice(
        isBn
          ? 'PDF বাজেট রিপোর্ট Pro ও Premium প্ল্যানে অন্তর্ভুক্ত। নিচে CSV ডাউনলোড বা আপগ্রেড করুন।'
          : 'PDF budget reports require a Pro or Premium plan. Use CSV export for free or upgrade your plan.'
      );
      return;
    }

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFontSize(18);
    pdf.text('NeatSpace AI — Room Organization Budget Report', 40, 48);
    pdf.setFontSize(10);
    pdf.text(
      `Generated ${new Date().toLocaleDateString()} · Target: $${totals.target} · Planned: $${totals.planned} · Spent: $${totals.spent}`,
      40,
      68
    );

    let y = 98;
    expenses.forEach((exp, idx) => {
      if (y > 760) {
        pdf.addPage();
        y = 50;
      }
      const line = `${idx + 1}. [${exp.purchased ? 'PAID' : 'PLANNED'}] ${exp.title} (${exp.category} · ${exp.roomName}) — Est $${exp.estimatedCost} / Actual $${exp.actualCost}`;
      pdf.text(line.slice(0, 95), 40, y);
      y += 20;
    });
    pdf.save(`neatspace-budget-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const spendPct = totals.target > 0 ? Math.min(100, Math.round((totals.spent / totals.target) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Top KPI Budget Summary Row */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#163D32]/65 dark:text-[#9FC6B0]">
              {isBn ? 'স্মার্ট বাজেট ও শপিং প্ল্যানার' : 'Smart Budget & Shopping Assistant'}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-0.5">
              {isBn ? 'রুম সাজানোর খরচ ও স্টোরেজ পরিকল্পনা' : 'Room Organization Budget & Expense Tracker'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] text-xs font-bold whitespace-nowrap hover:bg-[#DDF3E5]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isBn ? 'CSV ডাউনলোড' : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" />
              <span>{isBn ? 'PDF রিপোর্ট' : 'PDF Report'}</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="p-3 rounded-xl bg-[#E9B95B]/20 border border-[#E9B95B]/45 flex flex-wrap items-center justify-between gap-2 text-xs text-[#163D32] dark:text-[#EDF4EF]">
            <span>{exportNotice}</span>
            {onOpenPricing && (
              <button
                type="button"
                onClick={onOpenPricing}
                className="font-bold underline text-[#163D32] dark:text-[#E9B95B]"
              >
                {isBn ? 'প্ল্যান দেখুন' : 'View Pro Plans →'}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] space-y-2">
            <div className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0] font-semibold">
              {isBn ? 'মোট বাজেট লক্ষ্য' : 'Target Budget ($)'}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                aria-label="Room budget target"
                className="w-24 bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-lg px-2 py-1 text-sm font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
              />
              <button
                type="button"
                onClick={handleSaveTarget}
                className="px-2.5 py-1 rounded-lg bg-[#163D32] text-white text-xs font-bold"
              >
                {isBn ? 'সেট' : 'Set'}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638]">
            <div className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0] font-semibold">
              {isBn ? 'আনুমানিক পরিকল্পনা' : 'Estimated Planned'}
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF] mt-1">
              ${totals.planned.toFixed(0)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638]">
            <div className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0] font-semibold">
              {isBn ? 'প্রকৃত খরচ' : 'Actual Spent'}
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#E9B95B] mt-1">
              ${totals.spent.toFixed(0)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638]">
            <div className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0] font-semibold">
              {isBn ? 'বাজেট অবশিষ্ট' : 'Remaining Budget'}
            </div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                totals.remaining < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[#163D32] dark:text-[#DDF3E5]'
              }`}
            >
              {totals.remaining < 0 ? `-$${Math.abs(totals.remaining).toFixed(0)}` : `$${totals.remaining.toFixed(0)}`}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] tabular-nums">
            <span>{isBn ? 'বাজেট ব্যবহারের অগ্রগতি' : 'Budget Utilization'}</span>
            <span>{spendPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#163D32]/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totals.remaining < 0 ? 'bg-rose-500' : 'bg-[#163D32] dark:bg-[#E9B95B]'
              }`}
              style={{ width: `${spendPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Split: Expense Tracker (Left) + AI Shopping Assistant (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Expense Tracker & Item Form */}
        <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-5">
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#E9B95B]" />
            <span>{isBn ? 'খরচের তালিকা যোগ ও ট্র্যাক করুন' : 'Expense & Storage Item Tracker'}</span>
          </h3>

          <form onSubmit={handleCreateExpense} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638]">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isBn ? 'জিনিসের নাম (যেমন: ওভেন র‍্যাক / বক্স)' : 'Item name (e.g. Under-bed bins, Floating shelf)'}
                className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              />
            </div>

            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder={isBn ? 'রুমের নাম' : 'Room name'}
              className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BudgetExpense['category'])}
              aria-label="Expense category"
              className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder={isBn ? 'আনুমানিক ($)' : 'Estimated ($)'}
              className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none font-mono tabular-nums"
            />

            <input
              type="number"
              min={0}
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              placeholder={isBn ? 'প্রকৃত খরচ ($) ঐচ্ছিক' : 'Actual spent ($) optional'}
              className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none font-mono tabular-nums"
            />

            <div className="sm:col-span-2 flex gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isBn ? 'মাপ বা বিকল্প নোট (ঐচ্ছিক)' : 'Dimensions or DIY note (optional)'}
                className="flex-1 bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-[#E9B95B]" />
                <span>{isBn ? 'যোগ করুন' : 'Add'}</span>
              </button>
            </div>
          </form>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {(['All', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  filterCat === cat
                    ? 'bg-[#163D32] text-white'
                    : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/75 dark:text-[#B9D1C3]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-xs sm:text-sm text-[#163D32]/65 dark:text-[#9FC6B0]">
              {isBn
                ? 'এই ক্যাটাগরিতে এখনো কোনো খরচ যোগ করা হয়নি।'
                : 'No budget items added in this category yet. Add an item above or pick one from AI Shopping.'}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] flex items-start justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onTogglePurchased(exp.id)}
                    aria-label={exp.purchased ? 'Mark unpurchased' : 'Mark purchased'}
                    className="mt-0.5 text-[#163D32] dark:text-[#E9B95B] shrink-0"
                  >
                    {exp.purchased ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-xs sm:text-sm font-bold ${
                        exp.purchased
                          ? 'line-through text-[#163D32]/50 dark:text-[#9FC6B0]/50'
                          : 'text-[#163D32] dark:text-[#EDF4EF]'
                      }`}
                    >
                      {exp.title}
                    </div>
                    <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0] mt-0.5">
                      {exp.roomName} · {exp.category}
                      {exp.notes ? ` · ${exp.notes}` : ''}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className="font-mono tabular-nums text-xs">
                      <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
                        ${exp.actualCost}
                      </div>
                      <div className="text-[10px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                        est ${exp.estimatedCost}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(exp.id)}
                      aria-label="Delete expense"
                      className="p-1.5 text-[#163D32]/45 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Shopping Assistant Panel */}
        <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-5">
          <div>
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#E9B95B]" />
              <span>{isBn ? 'AI স্টোরেজ ও শপিং অ্যাসিস্ট্যান্ট' : 'AI Storage & Furniture Shopping Guide'}</span>
            </h3>
            <p className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0] mt-1">
              {isBn
                ? 'ঘরের মাপ ও বাজেট অনুযায়ী আদর্শ মাপের বক্স, শেল্ফ ও ফ্রি DIY বিকল্প পান।'
                : 'Get space-matched container categories, ideal dimensions, realistic planning ranges, and zero-cost DIY swaps.'}
            </p>
          </div>

          <form onSubmit={handleRunShoppingAssistant} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                {isBn ? 'রুমের ধরন' : 'Room Type'}
              </label>
              <select
                value={shopRoomType}
                onChange={(e) => setShopRoomType(e.target.value as RoomType)}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs text-[#163D32] dark:text-[#EDF4EF]"
              >
                {(Object.keys(t.roomLabels) as RoomType[]).map((rt) => (
                  <option key={rt} value={rt}>
                    {t.roomLabels[rt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                {isBn ? 'বাজেট ($)' : 'Max Budget ($)'}
              </label>
              <input
                type="number"
                min={10}
                value={shopBudget}
                onChange={(e) => setShopBudget(e.target.value)}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                {isBn ? `মাপ (${shopUnit})` : `Size (${shopUnit})`}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={3}
                  value={shopWidth}
                  onChange={(e) => setShopWidth(e.target.value)}
                  aria-label="Room width"
                  className="w-1/3 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2 py-2 text-xs font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
                />
                <span className="text-xs">×</span>
                <input
                  type="number"
                  min={3}
                  value={shopLength}
                  onChange={(e) => setShopLength(e.target.value)}
                  aria-label="Room length"
                  className="w-1/3 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2 py-2 text-xs font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
                />
                <button
                  type="button"
                  onClick={() => setShopUnit((u) => (u === 'ft' ? 'm' : 'ft'))}
                  className="px-2 py-2 rounded-xl bg-[#DDF3E5] text-[#163D32] text-xs font-bold shrink-0"
                >
                  {shopUnit}
                </button>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={shopFocus}
                onChange={(e) => setShopFocus(e.target.value)}
                placeholder={
                  isBn
                    ? 'কী গুছাতে চান? যেমন: তার, বই ও শীতের কাপড়'
                    : 'What needs organizing? e.g. cables, vertical closet space, toys'
                }
                className="flex-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              />
              <button
                type="submit"
                disabled={shopLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] text-xs font-bold whitespace-nowrap"
              >
                {shopLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isBn ? 'সাজেশন তৈরি করুন' : 'Suggest Organizers'}</span>
              </button>
            </div>
          </form>

          {shopError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{shopError}</span>
            </div>
          )}

          {shopSummary && (
            <div className="p-3.5 rounded-xl bg-[#DDF3E5]/60 dark:bg-[#1A3329] border border-[#163D32]/15 dark:border-[#264638] text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]">
              {shopSummary}
            </div>
          )}

          {recommendations.length > 0 ? (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {recommendations.map((rec, i) => (
                <div
                  key={`${rec.name}_${i}`}
                  className="p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                        {rec.name}
                      </div>
                      <div className="text-[11px] text-[#163D32]/70 dark:text-[#9FC6B0] font-mono tabular-nums">
                        {rec.category} · {rec.priority} · Est. {rec.estimatedCostRange} · Size {rec.idealDimensions}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(addedRecNames[rec.name])}
                      onClick={() => handleAddRecommendationToBudget(rec)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                        addedRecNames[rec.name]
                          ? 'bg-[#DDF3E5] text-[#163D32]'
                          : 'bg-[#163D32] hover:bg-[#102E25] text-white'
                      }`}
                    >
                      {addedRecNames[rec.name]
                        ? isBn
                          ? 'যুক্ত হয়েছে'
                          : 'Added'
                        : isBn
                        ? '+ বাজেটে যোগ'
                        : '+ Add to Budget'}
                    </button>
                  </div>

                  <p className="text-xs text-[#163D32]/85 dark:text-[#B9D1C3] leading-relaxed">
                    {rec.spaceFitReason}
                  </p>
                  <div className="text-[11px] text-[#163D32] dark:text-[#E9B95B] flex items-start gap-1.5 pt-1">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      <strong>{isBn ? 'ফ্রি DIY বিকল্প:' : 'Zero-cost DIY swap:'}</strong> {rec.diyAlternative}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                {isBn
                  ? '* দ্রষ্টব্য: দামগুলো পরিকল্পনার জন্য আনুমানিক পরিসর; কেনার আগে স্থানীয় দোকানে মাপ যাচাই করুন।'
                  : '* Note: Price ranges are general planning estimates rather than live store quotes.'}
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-dashed border-[#163D32]/20 dark:border-[#345C4B] text-center text-xs text-[#163D32]/70 dark:text-[#9FC6B0]">
              {isBn
                ? 'ঘরের মাপ ও বাজেট দিয়ে "সাজেশন তৈরি করুন" বাটনে ক্লিক করুন।'
                : 'Enter your room dimensions and budget cap above to generate tailored organizer categories.'}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteId)}
        title={isBn ? 'খরচের আইটেম মুছবেন?' : 'Delete Budget Item?'}
        description={
          isBn
            ? 'এই আইটেমটি আপনার বাজেট তালিকা থেকে মুছে যাবে।'
            : 'This expense entry will be permanently deleted from your room budget.'
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        destructive={true}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onDeleteExpense(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
};
