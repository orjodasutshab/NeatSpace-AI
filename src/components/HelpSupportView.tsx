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
    q: 'How is the Clutter Score (0â€“100) calculated?',
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
    q: 'à¦•à§à¦²à¦¾à¦Ÿà¦¾à¦° à¦¸à§à¦•à§‹à¦° (à§¦â€“à§§à§¦à§¦) à¦•à§€à¦­à¦¾à¦¬à§‡ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ à¦•à¦°à¦¾ à¦¹à§Ÿ?',
    a: 'AI à¦†à¦ªà¦¨à¦¾à¦° à¦°à§à¦®à§‡à¦° à¦›à¦¬à¦¿à¦¤à§‡ à¦®à§‡à¦à§‡à¦° à¦­à¦¿à§œ, à¦Ÿà§‡à¦¬à¦¿à¦²à§‡à¦° à¦¸à§à¦¤à§‚à¦ª, à¦¤à¦¾à¦°à§‡à¦° à¦œà¦Ÿ à¦“ à¦¹à¦¾à¦à¦Ÿà¦¾à¦° à¦ªà¦¥à§‡à¦° à¦¬à¦¾à¦§à¦¾ à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£ à¦•à¦°à§‡à¥¤ à§¦ à¦®à¦¾à¦¨à§‡ à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ à¦ªà¦°à¦¿à¦šà§à¦›à¦¨à§à¦¨ à¦à¦¬à¦‚ à§§à§¦à§¦ à¦®à¦¾à¦¨à§‡ à¦¬à§‡à¦¶à¦¿ à¦¬à¦¿à¦¶à§ƒà¦™à§à¦–à¦²à¦¾à¥¤ à¦§à¦¾à¦ªà¦—à§à¦²à§‹ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦•à¦°à¦²à§‡ à¦†à¦¨à§à¦®à¦¾à¦¨à¦¿à¦• à¦¸à§à¦•à§‹à¦° à¦•à¦®à§‡ à¦à¦¬à¦‚ à¦ªà¦°à§‡à¦° à¦›à¦¬à¦¿ à¦¦à¦¿à¦²à§‡ à¦¨à¦¤à§à¦¨ à¦°à¦¿à§Ÿà§‡à¦² à¦¸à§à¦•à§‹à¦° à¦ªà¦¾à¦“à§Ÿà¦¾ à¦¯à¦¾à§Ÿà¥¤',
  },
  {
    q: 'à¦†à¦®à¦¾à¦° à¦°à§à¦®à§‡à¦° à¦›à¦¬à¦¿ à¦“ à¦¤à¦¥à§à¦¯ à¦•à¦¿ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦“ à¦¬à§à¦¯à¦•à§à¦¤à¦¿à¦—à¦¤ à¦¥à¦¾à¦•à§‡?',
    a: 'à¦—à§‡à¦¸à§à¦Ÿ à¦®à§‹à¦¡à§‡ à¦¸à¦¬ à¦¤à¦¥à§à¦¯ à¦•à§‡à¦¬à¦² à¦†à¦ªà¦¨à¦¾à¦° à¦¬à§à¦°à¦¾à¦‰à¦œà¦¾à¦°à§‡ à¦¥à¦¾à¦•à§‡à¥¤ Google à¦¦à¦¿à§Ÿà§‡ à¦¸à¦¾à¦‡à¦¨ à¦‡à¦¨ à¦•à¦°à¦²à§‡ à¦¤à¦¥à§à¦¯ à¦†à¦ªà¦¨à¦¾à¦° à¦¨à¦¿à¦œà¦¸à§à¦¬ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦«à§‹à¦²à§à¦¡à¦¾à¦°à§‡ à¦¸à¦‚à¦°à¦•à§à¦·à¦¿à¦¤ à¦¹à§Ÿà¥¤ à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦² à¦“ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸ à¦¥à§‡à¦•à§‡ à¦¯à§‡à¦•à§‹à¦¨à§‹ à¦¸à¦®à§Ÿ à¦¸à¦¬ à¦¡à§‡à¦Ÿà¦¾ à¦¡à¦¾à¦‰à¦¨à¦²à§‹à¦¡ à¦¬à¦¾ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¸à§à¦¥à¦¾à§Ÿà§€à¦­à¦¾à¦¬à§‡ à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤',
  },
  {
    q: 'à§¨à¦¡à¦¿ à¦°à§à¦® à¦²à§‡à¦†à¦‰à¦Ÿ à¦ªà§à¦²à§à¦¯à¦¾à¦¨à¦¾à¦° à¦•à§€à¦­à¦¾à¦¬à§‡ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¬?',
    a: 'à¦«à§à¦Ÿ à¦¬à¦¾ à¦®à¦¿à¦Ÿà¦¾à¦°à§‡ à¦˜à¦°à§‡à¦° à¦¦à§ˆà¦°à§à¦˜à§à¦¯-à¦ªà§à¦°à¦¸à§à¦¥ à¦¦à¦¿à¦¨, à¦¦à¦°à¦œà¦¾ à¦“ à¦œà¦¾à¦¨à¦¾à¦²à¦¾ à¦¬à¦¸à¦¾à¦¨ à¦à¦¬à¦‚ à¦†à¦¸à¦¬à¦¾à¦¬ à¦¡à§à¦°à§à¦¯à¦¾à¦— à¦•à¦°à§‡ à¦šà¦²à¦¾à¦šà¦²à§‡à¦° à¦ªà¦¥ à¦ªà¦°à§€à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨à¥¤ AI à¦ªà§à¦²à§‡à¦¸à¦®à§‡à¦¨à§à¦Ÿ à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§‡ à¦¸à§‡à¦°à¦¾ à¦¸à¦¾à¦œà¦¾à¦¨à§‹à¦° à¦ªà¦°à¦¾à¦®à¦°à§à¦¶à¦“ à¦ªà§‡à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¦¨à¥¤',
  },
  {
    q: 'à¦®à¦¾à¦¸à¦¿à¦• AI à¦•à§‹à¦Ÿà¦¾ à¦•à¦–à¦¨ à¦°à¦¿à¦¸à§‡à¦Ÿ à¦¹à§Ÿ?',
    a: 'à¦ªà§à¦°à¦¤à¦¿ à¦®à¦¾à¦¸à§‡à¦° à§§ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦°à§à¦® à¦¸à§à¦•à§à¦¯à¦¾à¦¨, à¦°à¦¿à¦¡à¦¿à¦œà¦¾à¦‡à¦¨ à¦“ AI à¦•à§‹à¦šà§‡à¦° à¦®à¦¾à¦¸à¦¿à¦• à¦•à§‹à¦Ÿà¦¾ à¦¸à§à¦¬à§Ÿà¦‚à¦•à§à¦°à¦¿à§Ÿà¦­à¦¾à¦¬à§‡ à¦°à¦¿à¦¸à§‡à¦Ÿ à¦¹à§Ÿà¥¤',
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
        text: isBn ? 'à¦†à¦ªà¦¨à¦¾à¦° à¦®à¦¤à¦¾à¦®à¦¤ à¦¸à¦«à¦²à¦­à¦¾à¦¬à§‡ à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à§Ÿà§‡à¦›à§‡!' : 'Thank you! Your feedback has been submitted.',
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
          ? 'à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿà¦Ÿà¦¿ à¦œà¦®à¦¾ à¦¹à§Ÿà§‡à¦›à§‡à¥¤ à¦¸à¦¾à¦ªà§‹à¦°à§à¦Ÿ à¦Ÿà¦¿à¦® à¦¦à§à¦°à§à¦¤ à¦ªà¦°à§à¦¯à¦¾à¦²à§‹à¦šà¦¨à¦¾ à¦•à¦°à¦¬à§‡à¥¤'
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
            {isBn ? 'à¦¹à§‡à¦²à§à¦ª à¦¸à§‡à¦¨à§à¦Ÿà¦¾à¦° à¦“ à¦¸à¦¾à¦ªà§‹à¦°à§à¦Ÿ' : 'Help Center & Support'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'à¦¸à¦¹à¦¾à§Ÿà¦¤à¦¾, à¦®à¦¤à¦¾à¦®à¦¤ à¦“ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ' : 'Guides, Feedback & Issue Reporting'}
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenTutorial}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          <span>{isBn ? 'à¦‡à¦¨à§à¦Ÿà¦¾à¦°â€à§à¦¯à¦¾à¦•à§à¦Ÿà¦¿à¦­ à¦—à¦¾à¦‡à¦¡ à¦–à§à¦²à§à¦¨' : 'Launch Interactive Tour'}</span>
