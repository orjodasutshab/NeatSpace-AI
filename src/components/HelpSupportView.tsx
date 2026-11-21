import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { FeedbackItem, OutputLanguage, UserReportItem } from '../types';
import { submitFeedbackToFirestore, submitReportToFirestore } from '../firebase';
import {
  HelpCircle,
  Search,
  ChevronDown,
  MessageSquarePlus,
  Flag,
  BookOpen,
  LogIn,
  CheckCircle2,
  Star,
  AlertCircle,
  Mail,
} from 'lucide-react';

interface HelpSupportViewProps {
  user: User | null;
  language: OutputLanguage;
  userFeedbacks: FeedbackItem[];
  userReports: UserReportItem[];
  onSignIn: () => void;
  onOpenTutorial: () => void;
}

const FAQS_EN = [
  {
    q: 'How is the Clutter Score (0–100) calculated?',
    a: 'AI analyzes visible floor congestion, surface piles, cable tangles, and pathway blockages in your photo. 0 indicates an immaculate room while 100 indicates heavy clutter. Checking off steps updates a live estimated score, and uploading an After photo provides a fresh visual score.',
  },
  {
    q: 'Are my room photos and personal plans kept private?',
    a: 'Guest mode stores data solely in your browser localStorage. When signed in with Google, rooms, inventory, tasks, and layouts are stored under your private user path protected by strict Firestore security rules. You can export or permanently delete your account anytime in Profile & Settings.',
  },
  {
    q: 'How does the 2D Room Layout Planner work?',
    a: 'Enter your room width, length, and ceiling height in feet or meters, place doors/windows, add scaled furniture, and drag items to test walkways. You can also ask AI to optimize placement for natural light and clear paths (>= 2.5 ft / 0.76 m).',
  },
  {
    q: 'How do subscription quotas reset?',
    a: 'Monthly Room Scans, AI Redesigns, and Voice Coach message counters automatically reset on the 1st of each calendar month.',
  },
  {
    q: 'Why does Before & After resize my photos slightly?',
    a: 'Images are resized in the browser before cloud sync so saved rooms load quickly across mobile and desktop connections while staying safely within database document limits.',
  },
];

const FAQS_BN = [
  {
    q: 'ক্লাটার স্কোর (০–১০০) কীভাবে নির্ধারণ করা হয়?',
    a: 'AI আপনার রুমের ছবিতে মেঝের ভিড়, টেবিলের স্তূপ, তারের জট ও হাঁটার পথের বাধা বিশ্লেষণ করে। ০ মানে সম্পূর্ণ পরিচ্ছন্ন এবং ১০০ মানে বেশি বিশৃঙ্খলা। ধাপগুলো সম্পন্ন করলে আনুমানিক স্কোর কমে এবং পরের ছবি দিলে নতুন রিয়েল স্কোর পাওয়া যায়।',
  },
  {
    q: 'আমার রুমের ছবি ও তথ্য কি নিরাপদ ও ব্যক্তিগত থাকে?',
    a: 'গেস্ট মোডে সব তথ্য কেবল আপনার ব্রাউজারে থাকে। Google দিয়ে সাইন ইন করলে তথ্য আপনার নিজস্ব নিরাপদ ফোল্ডারে সংরক্ষিত হয়। প্রোফাইল ও সেটিংস থেকে যেকোনো সময় সব ডেটা ডাউনলোড বা অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলতে পারবেন।',
  },
  {
    q: '২ডি রুম লেআউট প্ল্যানার কীভাবে ব্যবহার করব?',
    a: 'ফুট বা মিটারে ঘরের দৈর্ঘ্য-প্রস্থ দিন, দরজা ও জানালা বসান এবং আসবাব ড্র্যাগ করে চলাচলের পথ পরীক্ষা করুন। AI প্লেসমেন্ট বাটনে ক্লিক করে সেরা সাজানোর পরামর্শও পেতে পারেন।',
  },
  {
    q: 'মাসিক AI কোটা কখন রিসেট হয়?',
    a: 'প্রতি মাসের ১ তারিখে রুম স্ক্যান, রিডিজাইন ও AI কোচের মাসিক কোটা স্বয়ংক্রিয়ভাবে রিসেট হয়।',
  },
];

export const HelpSupportView: React.FC<HelpSupportViewProps> = ({
  user,
  language,
  userFeedbacks,
  userReports,
  onSignIn,
  onOpenTutorial,
}) => {
  const isBn = language === 'bn';
  const faqs = isBn ? FAQS_BN : FAQS_EN;

  const [tab, setTab] = useState<'faq' | 'feedback' | 'report'>('faq');
  const [faqQuery, setFaqQuery] = useState('');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Feedback form
  const [fbCategory, setFbCategory] = useState<FeedbackItem['category']>('feature');
  const [fbRating, setFbRating] = useState<number>(5);
  const [fbMessage, setFbMessage] = useState('');
  const [fbSaving, setFbSaving] = useState(false);

  // Report form
  const [repType, setRepType] = useState<UserReportItem['reportType']>('bug');
  const [repSubject, setRepSubject] = useState('');
  const [repSection, setRepSection] = useState('Dashboard');
  const [repDetails, setRepDetails] = useState('');
  const [repSaving, setRepSaving] = useState(false);

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const filteredFaqs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );
  }, [faqQuery, faqs]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fbMessage.trim()) return;
    setFbSaving(true);
    setToast(null);
    try {
      await submitFeedbackToFirestore(user, {
        category: fbCategory,
        rating: fbRating,
        message: fbMessage.trim(),
      });
      setFbMessage('');
      setToast({
        type: 'ok',
        text: isBn ? 'আপনার মতামত সফলভাবে পাঠানো হয়েছে!' : 'Thank you! Your feedback has been submitted.',
      });
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Unable to submit feedback.' });
    } finally {
      setFbSaving(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !repSubject.trim() || !repDetails.trim()) return;
    setRepSaving(true);
    setToast(null);
    try {
      await submitReportToFirestore(user, {
        reportType: repType,
        subject: repSubject.trim(),
        details: repDetails.trim(),
        pageSection: repSection,
      });
      setRepSubject('');
      setRepDetails('');
      setToast({
        type: 'ok',
        text: isBn
          ? 'রিপোর্টটি জমা হয়েছে। সাপোর্ট টিম দ্রুত পর্যালোচনা করবে।'
          : 'Report submitted! Our moderation team will review it shortly.',
      });
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Unable to submit report.' });
    } finally {
      setRepSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? 'হেল্প সেন্টার ও সাপোর্ট' : 'Help Center & Support'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'সহায়তা, মতামত ও সমস্যা রিপোর্ট' : 'Guides, Feedback & Issue Reporting'}
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenTutorial}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          <span>{isBn ? 'ইন্টার‍্যাক্টিভ গাইড খুলুন' : 'Launch Interactive Tour'}</span>
        </button>
      </div>

      {/* Section Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638]">
        {[
          { id: 'faq' as const, label: isBn ? 'সাধারণ প্রশ্ন (FAQ)' : 'FAQ & Guides', icon: <HelpCircle className="w-4 h-4" /> },
          { id: 'feedback' as const, label: isBn ? 'মতামত দিন' : 'Send Feedback', icon: <MessageSquarePlus className="w-4 h-4" /> },
          { id: 'report' as const, label: isBn ? 'সমস্যা রিপোর্ট' : 'Report Issue', icon: <Flag className="w-4 h-4" /> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setToast(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-[#163D32] text-white'
                : 'text-[#163D32]/75 dark:text-[#B9D1C3] hover:text-[#163D32]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {toast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs sm:text-sm ${
            toast.type === 'ok'
              ? 'bg-[#DDF3E5] border-[#163D32]/20 text-[#163D32]'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* TAB 1: Searchable FAQ */}
      {tab === 'faq' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[#163D32]/50 dark:text-[#9FC6B0] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder={isBn ? 'প্রশ্ন খুঁজুন...' : 'Search help articles & FAQs...'}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              />
            </div>

            <div className="space-y-2.5">
              {filteredFaqs.map((faq, idx) => {
                const open = openFaqIdx === idx;
                return (
                  <div
                    key={faq.q}
                    className="rounded-xl border border-[#163D32]/10 dark:border-[#264638] bg-[#F7F9F6] dark:bg-[#182C24] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(open ? null : idx)}
                      aria-expanded={open}
                      className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-4 pb-4 text-xs sm:text-sm text-[#163D32]/80 dark:text-[#B9D1C3] leading-relaxed border-t border-[#163D32]/10 dark:border-[#264638] pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direct Support Info Card */}
          <div className="lg:col-span-4 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#E9B95B]" />
              <span>{isBn ? 'সরাসরি যোগাযোগ' : 'Contact Support'}</span>
            </h3>
            <p className="text-xs sm:text-sm text-[#163D32]/75 dark:text-[#B9D1C3] leading-relaxed">
              {isBn
                ? 'অ্যাকাউন্ট, বিলিং বা বাগ সংক্রান্ত সহায়তার জন্য রিপোর্ট ফর্ম ব্যবহার করুন অথবা ইমেইল করুন।'
                : 'Need help with billing, privacy exports, or troubleshooting? Submit a tracked ticket in the Report Issue tab or reach our support desk.'}
            </p>
            <div className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-xs space-y-1">
              <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">Support Desk</div>
              <div className="font-mono text-[#163D32]/80 dark:text-[#E9B95B]">support@neatspace.ai</div>
              <div className="text-[#163D32]/60 dark:text-[#9FC6B0]">Typical response: 1 business day</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Submit Feedback */}
      {tab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'অ্যাপের মান উন্নয়নে আপনার মতামত দিন' : 'Share Product Feedback'}
            </h3>

            {!user ? (
              <div className="p-5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] text-center space-y-3">
                <p className="text-xs sm:text-sm text-[#163D32]/80 dark:text-[#B9D1C3]">
                  {isBn
                    ? 'মতামত পাঠাতে ও আপনার ফিডব্যাক স্ট্যাটাস ট্র্যাক করতে সাইন ইন করুন।'
                    : 'Sign in with Google to submit tracked feedback and view responses.'}
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] text-white text-xs font-bold"
                >
                  <LogIn className="w-4 h-4 text-[#E9B95B]" />
                  <span>{isBn ? 'সাইন ইন করুন' : 'Sign In with Google'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                      {isBn ? 'ক্যাটাগরি' : 'Category'}
                    </label>
                    <select
                      value={fbCategory}
                      onChange={(e) => setFbCategory(e.target.value as FeedbackItem['category'])}
                      className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
                    >
                      <option value="feature">Feature Request</option>
                      <option value="ux">Design & Usability</option>
                      <option value="ai_quality">AI Plan Quality</option>
                      <option value="praise">Praise</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                      {isBn ? 'রেটিং' : 'Rating'}
                    </label>
                    <div className="flex items-center gap-1.5 py-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFbRating(star)}
                          aria-label={`${star} stars`}
                          className="p-1"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= fbRating
                                ? 'fill-[#E9B95B] text-[#E9B95B]'
                                : 'text-[#163D32]/25 dark:text-white/25'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <textarea
                  required
                  rows={4}
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  placeholder={
                    isBn
                      ? 'আপনার অভিজ্ঞতা বা নতুন কোনো ফিচারের পরামর্শ লিখুন...'
                      : 'Tell us what worked well or what feature we should prioritize next...'
                  }
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />

                <button
                  type="submit"
                  disabled={fbSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs sm:text-sm font-bold"
                >
                  {fbSaving ? (isBn ? 'পাঠানো হচ্ছে...' : 'Submitting...') : (isBn ? 'মতামত পাঠান' : 'Submit Feedback')}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'আপনার পাঠানো মতামত' : 'Your Submitted Feedback'}
            </h3>
            {userFeedbacks.length === 0 ? (
              <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] py-4">
                {isBn ? 'এখনো কোনো মতামত পাঠানো হয়নি।' : 'No feedback submissions yet.'}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {userFeedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold uppercase">{fb.category} · {fb.rating}/5</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#DDF3E5] text-[#163D32] font-bold uppercase text-[10px]">
                        {fb.status}
                      </span>
                    </div>
                    <p className="text-[#163D32]/85 dark:text-[#EDF4EF]">{fb.message}</p>
                    {fb.adminNote && (
                      <div className="pt-1.5 border-t border-[#163D32]/10 text-[#163D32] dark:text-[#E9B95B]">
                        <strong>Team Reply:</strong> {fb.adminNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Report Bug / Issue */}
      {tab === 'report' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'বাগ, বিলিং বা প্রাইভেসি রিপোর্ট' : 'Report a Bug or Issue'}
            </h3>

            {!user ? (
              <div className="p-5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] text-center space-y-3">
                <p className="text-xs sm:text-sm text-[#163D32]/80 dark:text-[#B9D1C3]">
                  {isBn ? 'রিপোর্ট জমা দিতে সাইন ইন করুন।' : 'Please sign in to submit an issue report.'}
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] text-white text-xs font-bold"
                >
                  <LogIn className="w-4 h-4 text-[#E9B95B]" />
                  <span>{isBn ? 'সাইন ইন করুন' : 'Sign In with Google'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                      {isBn ? 'রিপোর্টের ধরন' : 'Report Type'}
                    </label>
                    <select
                      value={repType}
                      onChange={(e) => setRepType(e.target.value as UserReportItem['reportType'])}
                      className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
                    >
                      <option value="bug">Technical Bug</option>
                      <option value="billing">Billing / Plan Issue</option>
                      <option value="privacy">Privacy / Data Request</option>
                      <option value="abuse">Inappropriate Output / Abuse</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                      {isBn ? 'অ্যাপের সেকশন' : 'Affected Section'}
                    </label>
                    <input
                      type="text"
                      value={repSection}
                      onChange={(e) => setRepSection(e.target.value)}
                      className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={repSubject}
                  onChange={(e) => setRepSubject(e.target.value)}
                  placeholder={isBn ? 'সমস্যার সংক্ষিপ্ত শিরোনাম' : 'Short summary subject'}
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />

                <textarea
                  required
                  rows={4}
                  value={repDetails}
                  onChange={(e) => setRepDetails(e.target.value)}
                  placeholder={isBn ? 'কী হয়েছিল এবং কীভাবে আবার ঘটানো যায় লিখুন...' : 'Describe what happened and steps to reproduce...'}
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />

                <button
                  type="submit"
                  disabled={repSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs sm:text-sm font-bold"
                >
                  {repSaving ? (isBn ? 'জমা হচ্ছে...' : 'Sending...') : (isBn ? 'রিপোর্ট জমা দিন' : 'Submit Report')}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'আপনার রিপোর্টের অবস্থা' : 'Your Submitted Reports'}
            </h3>
            {userReports.length === 0 ? (
              <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] py-4">
                {isBn ? 'কোনো সক্রিয় রিপোর্ট নেই।' : 'No reports submitted yet.'}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {userReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{rep.subject}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#E9B95B]/30 text-[#163D32] dark:text-[#E9B95B] font-bold uppercase text-[10px]">
                        {rep.status}
                      </span>
                    </div>
                    <p className="text-[#163D32]/80 dark:text-[#B9D1C3]">{rep.details}</p>
                    {rep.adminResolution && (
                      <div className="pt-1.5 border-t border-[#163D32]/10 text-[#163D32] dark:text-[#DDF3E5]">
                        <strong>Resolution:</strong> {rep.adminResolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
