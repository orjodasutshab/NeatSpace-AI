import React, { useState, useRef } from 'react';
import {
  OutputLanguage,
  RoomAnalysis,
  StorageCategory,
  StorageInventoryItem,
  StorageUsageFrequency,
} from '../types';
import { prepareImageForAnalysis } from '../utils/imageUtils';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Package,
  Plus,
  Search,
  Trash2,
  MapPin,
  Download,
  Camera,
  Sparkles,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface StorageInventoryViewProps {
  items: StorageInventoryItem[];
  activeRoom: RoomAnalysis | null;
  rooms?: string[];
  language: OutputLanguage;
  onAddItem: (item: Omit<StorageInventoryItem, 'id' | 'updatedAt'>) => void;
  onUpdateQty: (id: string, delta: number) => void;
  onUpdateItem: (item: StorageInventoryItem) => void;
  onDeleteItem: (id: string) => void;
}

const STANDARD_CATEGORIES: StorageCategory[] = [
  'Clothes',
  'Books',
  'Electronics',
  'Kitchen Items',
  'Decorations',
  'Documents',
  'Tools',
  'Other',
];

interface AiStorageSuggestion {
  itemName: string;
  currentLocation: string;
  suggestedLocation: string;
  reason: string;
  actionType: 'relocate' | 'group' | 'donate' | 'declutter';
}

export const StorageInventoryView: React.FC<StorageInventoryViewProps> = ({
  items,
  activeRoom,
  rooms = [],
  language,
  onAddItem,
  onUpdateQty,
  onUpdateItem,
  onDeleteItem,
}) => {
  const isBn = language === 'bn';
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [usageFilter, setUsageFilter] = useState<'all' | StorageUsageFrequency>('all');

  // Add item form state
  const [itemName, setItemName] = useState('');
  const [location, setLocation] = useState('');
  const [roomName, setRoomName] = useState(activeRoom?.roomName || 'Bedroom');
  const [category, setCategory] = useState<StorageCategory>('Electronics');
  const [usageFrequency, setUsageFrequency] = useState<StorageUsageFrequency>('frequent');
  const [quantity, setQuantity] = useState(1);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const photoRef = useRef<HTMLInputElement>(null);

  // Edit inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    itemName: string;
    location: string;
    roomName: string;
    category: string;
    usageFrequency: StorageUsageFrequency;
  } | null>(null);

  // Delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // AI Storage Optimizer state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<{
    summary: string;
    suggestions: AiStorageSuggestion[];
  } | null>(null);

  const uniqueRooms = Array.from(new Set(items.map((i) => i.roomName).filter(Boolean)));

  const filtered = items.filter((item) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.itemName.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.roomName.toLowerCase().includes(q);
    const matchesRoom = roomFilter === 'all' || item.roomName === roomFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesUsage = usageFilter === 'all' || (item.usageFrequency || 'frequent') === usageFilter;
    return matchesSearch && matchesRoom && matchesCategory && matchesUsage;
  });

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || '');
      if (!raw) return;
      const compact = await prepareImageForAnalysis(raw, 360, 0.72);
      setPhotoUrl(compact);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !location.trim()) return;
    onAddItem({
      itemName: itemName.trim(),
      location: location.trim(),
      roomName: roomName.trim() || 'General Room',
      category,
      quantity: Math.max(1, quantity),
      usageFrequency,
      ...(photoUrl ? { photoUrl } : {}),
    });
    setItemName('');
    setLocation('');
    setQuantity(1);
    setPhotoUrl('');
  };

  const handleImportFromActiveRoom = () => {
    if (!activeRoom) return;
    const candidates = activeRoom.storageRecommendations || [];
    candidates.forEach((rec) => {
      const alreadyExists = items.some(
        (i) => i.itemName.toLowerCase() === rec.itemTitle.toLowerCase()
      );
      if (!alreadyExists) {
        onAddItem({
          itemName: rec.itemTitle,
          location: rec.suggestedLocation,
          roomName: activeRoom.roomName,
          category: 'Other',
          quantity: 1,
          usageFrequency: 'frequent',
        });
      }
    });
  };

  const handleStartEdit = (item: StorageInventoryItem) => {
    setEditingId(item.id);
    setEditDraft({
      itemName: item.itemName,
      location: item.location,
      roomName: item.roomName,
      category: item.category,
      usageFrequency: item.usageFrequency || 'frequent',
    });
  };

  const handleSaveEdit = (original: StorageInventoryItem) => {
    if (!editDraft || !editDraft.itemName.trim() || !editDraft.location.trim()) return;
    onUpdateItem({
      ...original,
      itemName: editDraft.itemName.trim(),
      location: editDraft.location.trim(),
      roomName: editDraft.roomName.trim() || original.roomName,
      category: editDraft.category,
      usageFrequency: editDraft.usageFrequency,
      updatedAt: Date.now(),
    });
    setEditingId(null);
    setEditDraft(null);
  };

  const handleAiOptimize = async () => {
    if (items.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch('/api/storage-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          rooms: rooms.length > 0 ? rooms : uniqueRooms,
          language,
        }),
      });
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        setAiError(isBn ? 'সার্ভার প্রস্তুত হচ্ছে, একটু পর আবার চেষ্টা করুন।' : 'Server warming up. Try again shortly.');
        return;
      }
      const data = JSON.parse(text);
      if (resp.ok && data.success) {
        setAiAdvice({ summary: data.summary || '', suggestions: data.suggestions || [] });
      } else {
        setAiError(data.details || data.error || 'Could not generate AI storage suggestions.');
      }
    } catch (err: any) {
      setAiError(err?.message || 'Error contacting AI storage optimizer.');
    } finally {
      setAiLoading(false);
    }
  };

  const renderUsageBadge = (usage?: StorageUsageFrequency) => {
    const u = usage || 'frequent';
    if (u === 'unused') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
          {isBn ? 'অব্যবহৃত' : 'Unused'}
        </span>
      );
    }
    if (u === 'occasional') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E9B95B]/35 text-[#163D32] dark:text-[#FDE68A]">
          {isBn ? 'মাঝেমধ্যে' : 'Occasional'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#DDF3E5] text-[#163D32]">
        {isBn ? 'নিয়মিত' : 'Frequent'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'স্মার্ট স্টোরেজ ইনভেন্টরি' : 'Smart Storage Inventory'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-0.5">
            {isBn ? 'কোন জিনিস কোথায় রাখা আছে তার তালিকা' : 'Track What Is Stored Where'}
          </h2>
          <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3] mt-1">
            {isBn
              ? 'আলমারি, বক্স, ড্রয়ার বা শেল্ফের জিনিস ছবি ও ব্যবহারের ধরনসহ সংরক্ষণ করুন।'
              : 'Log exact bin, drawer, or shelf locations with photos, usage frequency, and AI placement ideas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {items.length > 0 && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleAiOptimize}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold transition-colors whitespace-nowrap"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#E9B95B]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#E9B95B]" />
              )}
              <span>{isBn ? 'AI স্মার্ট স্টোরেজ পরামর্শ' : 'AI Suggest Better Storage'}</span>
            </button>
          )}

          {activeRoom && activeRoom.storageRecommendations.length > 0 && (
            <button
              type="button"
              onClick={handleImportFromActiveRoom}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>
                {isBn ? `${activeRoom.roomName} থেকে ইমপোর্ট` : `Import from ${activeRoom.roomName}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* AI Optimization Insights Card */}
      {aiError && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-xs sm:text-sm">
          {aiError}
        </div>
      )}

      {aiAdvice && (
        <div className="bg-[#DDF3E5]/55 dark:bg-[#1A3329] border border-[#163D32]/15 dark:border-[#2B4E3F] rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#163D32] dark:text-[#E9B95B] uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>{isBn ? 'AI স্টোরেজ অপ্টিমাইজেশন' : 'AI Storage Optimization Plan'}</span>
              </div>
              <p className="text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] leading-relaxed">
                {aiAdvice.summary}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiAdvice(null)}
              aria-label="Dismiss AI suggestions"
              className="p-1 text-[#163D32]/60 dark:text-[#B9D1C3]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {aiAdvice.suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiAdvice.suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-xl p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]">
                      {sug.itemName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#E9B95B]/30 text-[#163D32] dark:text-[#E9B95B] text-[10px] font-bold uppercase">
                      {sug.actionType}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#163D32]/70 dark:text-[#9FC6B0]">
                    {sug.currentLocation} → <strong className="text-[#163D32] dark:text-[#EDF4EF]">{sug.suggestedLocation}</strong>
                  </div>
                  <p className="text-xs text-[#163D32]/80 dark:text-[#B9D1C3] leading-snug">
                    {sug.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Inventory Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
      >
        <div className="sm:col-span-3 space-y-1">
          <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
            {isBn ? 'জিনিসের নাম' : 'Item / Contents'}
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder={isBn ? 'যেমন: শীতের জ্যাকেট / কেবল' : 'e.g. Spare USB-C Cables'}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
            {isBn ? 'কোথায় রাখা হয়েছে (বক্স/তাক)' : 'Exact Storage Location'}
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={isBn ? 'যেমন: উপরের শেল্ফ · নীল বক্স' : 'e.g. Top Shelf · Bin #2'}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
            {isBn ? 'রুম' : 'Room'}
          </label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Bedroom"
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
            {isBn ? 'ক্যাটাগরি' : 'Category'}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as StorageCategory)}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          >
            {STANDARD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
            {isBn ? 'ব্যবহার' : 'Usage'}
          </label>
          <select
            value={usageFrequency}
            onChange={(e) => setUsageFrequency(e.target.value as StorageUsageFrequency)}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          >
            <option value="frequent">{isBn ? 'নিয়মিত' : 'Frequent'}</option>
            <option value="occasional">{isBn ? 'মাঝেমধ্যে' : 'Occasional'}</option>
            <option value="unused">{isBn ? 'অব্যবহৃত' : 'Unused'}</option>
          </select>
        </div>

        <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoPick}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{photoUrl ? (isBn ? 'ছবি বদলান' : 'Change Photo') : (isBn ? 'ছবি যোগ করুন (ঐচ্ছিক)' : 'Attach Photo (Optional)')}</span>
            </button>
            {photoUrl && (
              <img
                src={photoUrl}
                alt="Item preview"
                className="w-9 h-9 rounded-lg object-cover border border-[#163D32]/20"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
              {isBn ? 'সংখ্যা:' : 'Qty:'}
            </label>
            <input
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              aria-label="Quantity"
              className="w-16 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2 py-2 text-xs sm:text-sm font-mono text-center text-[#163D32] dark:text-[#EDF4EF]"
            />
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? 'ইনভেন্টরিতে যোগ করুন' : 'Add to Inventory'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#163D32]/50 dark:text-[#9FC6B0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isBn ? 'জিনিস, বক্স বা জায়গা খুঁজুন...' : 'Search item, bin, shelf, or category...'
              }
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
          </div>

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
          >
            <option value="all">{isBn ? 'সব রুম' : 'All Rooms'}</option>
            {uniqueRooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
          >
            <option value="all">{isBn ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
            {STANDARD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Usage Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'frequent', 'occasional', 'unused'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUsageFilter(u)}
              className={`px-3 py-1 rounded-xl text-xs font-bold border capitalize transition-colors ${
                usageFilter === u
                  ? 'bg-[#163D32] text-white border-[#163D32]'
                  : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/75 dark:text-[#B9D1C3] border-[#163D32]/10 dark:border-[#264638]'
              }`}
            >
              {u === 'all' ? (isBn ? 'সব ব্যবহার' : 'All Usage') : u}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-[#163D32]/60 dark:text-[#9FC6B0] space-y-2">
            <Package className="w-10 h-10 mx-auto text-[#163D32]/25 dark:text-[#9FC6B0]/30" />
            <p className="text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'ইনভেন্টরিতে কোনো জিনিস পাওয়া যায়নি' : 'No stored items match your filters'}
            </p>
            <p className="text-xs">
              {isBn
                ? 'উপরের ফর্ম ব্যবহার করে জিনিসের অবস্থান যোগ করুন।'
                : 'Add items above to keep a searchable map of your closets, bins, and drawers.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#163D32]/10 dark:border-[#264638] text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
                    <th className="py-2.5 px-3 font-semibold">{isBn ? 'জিনিস' : 'Item'}</th>
                    <th className="py-2.5 px-3 font-semibold">{isBn ? 'অবস্থান' : 'Stored Where'}</th>
                    <th className="py-2.5 px-3 font-semibold">{isBn ? 'রুম' : 'Room'}</th>
                    <th className="py-2.5 px-3 font-semibold">{isBn ? 'ক্যাটাগরি' : 'Category'}</th>
                    <th className="py-2.5 px-3 font-semibold">{isBn ? 'ব্যবহার' : 'Usage'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isBn ? 'সংখ্যা' : 'Qty'}</th>
                    <th className="py-2.5 px-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#163D32]/10 dark:divide-[#264638]">
                  {filtered.map((item) => {
                    const isEditing = editingId === item.id && editDraft;
                    return (
                      <tr key={item.id} className="hover:bg-[#F7F9F6] dark:hover:bg-[#182C24] transition-colors">
                        <td className="py-3 px-3 font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft.itemName}
                              onChange={(e) => setEditDraft({ ...editDraft, itemName: e.target.value })}
                              className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/25 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            <div className="flex items-center gap-2.5">
                              {item.photoUrl && (
                                <img
                                  src={item.photoUrl}
                                  alt={item.itemName}
                                  className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[#163D32]/15"
                                />
                              )}
                              <span>{item.itemName}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#163D32]/80 dark:text-[#B9D1C3]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft.location}
                              onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })}
                              className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/25 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#163D32]/50 dark:text-[#9FC6B0]" />
                              {item.location}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#163D32]/75 dark:text-[#B9D1C3]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft.roomName}
                              onChange={(e) => setEditDraft({ ...editDraft, roomName: e.target.value })}
                              className="w-24 bg-white dark:bg-[#13241D] border border-[#163D32]/25 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            item.roomName
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#163D32]/70 dark:text-[#9FC6B0]">
                          {isEditing ? (
                            <select
                              value={editDraft.category}
                              onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                              className="bg-white dark:bg-[#13241D] border border-[#163D32]/25 rounded-lg px-2 py-1 text-xs"
                            >
                              {STANDARD_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.category
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {isEditing ? (
                            <select
                              value={editDraft.usageFrequency}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  usageFrequency: e.target.value as StorageUsageFrequency,
                                })
                              }
                              className="bg-white dark:bg-[#13241D] border border-[#163D32]/25 rounded-lg px-2 py-1 text-xs"
                            >
                              <option value="frequent">Frequent</option>
                              <option value="occasional">Occasional</option>
                              <option value="unused">Unused</option>
                            </select>
                          ) : (
                            renderUsageBadge(item.usageFrequency)
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.id, -1)}
                              className="w-6 h-6 rounded-md bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-[#163D32] dark:text-[#EDF4EF]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.id, 1)}
                              className="w-6 h-6 rounded-md bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item)}
                                aria-label="Save edit"
                                className="p-1.5 text-[#163D32] dark:text-[#6EE7B7] rounded-lg"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditDraft(null);
                                }}
                                aria-label="Cancel edit"
                                className="p-1.5 text-[#163D32]/50 dark:text-[#B9D1C3] rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                aria-label="Edit item"
                                className="p-1.5 text-[#163D32]/45 dark:text-[#9FC6B0] hover:text-[#163D32] rounded-lg"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(item.id)}
                                aria-label="Delete item"
                                className="p-1.5 text-[#163D32]/40 dark:text-[#9FC6B0] hover:text-rose-600 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.photoUrl && (
                      <img
                        src={item.photoUrl}
                        alt={item.itemName}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[#163D32]/15"
                      />
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF] truncate">
                          {item.itemName}
                        </span>
                        {renderUsageBadge(item.usageFrequency)}
                      </div>
                      <div className="text-xs text-[#163D32]/75 dark:text-[#B9D1C3] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                      <div className="text-[11px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                        {item.roomName} · {item.category}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] font-bold text-xs text-[#163D32] dark:text-[#EDF4EF]"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-xs font-mono font-bold tabular-nums text-[#163D32] dark:text-[#EDF4EF]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, 1)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] font-bold text-xs text-[#163D32] dark:text-[#EDF4EF]"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(item.id)}
                      aria-label="Delete item"
                      className="p-2 text-rose-600 dark:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteId)}
        title={isBn ? 'আইটেম মুছে ফেলবেন?' : 'Delete Inventory Item?'}
        description={
          isBn
            ? 'এই স্টোরেজ আইটেমটি আপনার তালিকা থেকে স্থায়ীভাবে মুছে যাবে।'
            : 'This stored item record will be permanently removed from your inventory.'
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        onConfirm={() => {
          if (pendingDeleteId) onDeleteItem(pendingDeleteId);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
};
