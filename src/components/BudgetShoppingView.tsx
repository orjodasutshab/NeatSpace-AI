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
          ? 'à¦…à§à¦¯à¦¾à¦¡à¦®à¦¿à¦¨ à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨à§‡ AI à¦¶à¦ªà¦¿à¦‚ à¦…à§à¦¯à¦¾à¦¸à¦¿à¦¸à§à¦Ÿà§à¦¯à¦¾à¦¨à§à¦Ÿ à¦¸à¦¾à¦®à§Ÿà¦¿à¦•à¦­à¦¾à¦¬à§‡ à¦¬à¦¨à§à¦§ à¦°à§‡à¦–à§‡à¦›à§‡à¦¨à¥¤'
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
          ? 'PDF à¦¬à¦¾à¦œà§‡à¦Ÿ à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ Pro à¦“ Premium à¦ªà§à¦²à§à¦¯à¦¾à¦¨à§‡ à¦…à¦¨à§à¦¤à¦°à§à¦­à§à¦•à§à¦¤à¥¤ à¦¨à¦¿à¦šà§‡ CSV à¦¡à¦¾à¦‰à¦¨à¦²à§‹à¦¡ à¦¬à¦¾ à¦†à¦ªà¦—à§à¦°à§‡à¦¡ à¦•à¦°à§à¦¨à¥¤'
          : 'PDF budget reports require a Pro or Premium plan. Use CSV export for free or upgrade your plan.'
      );
      return;
    }

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFontSize(18);
    pdf.text('NeatSpace AI â€” Room Organization Budget Report', 40, 48);
    pdf.setFontSize(10);
    pdf.text(
