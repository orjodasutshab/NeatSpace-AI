import React, { useState } from 'react';
import { OutputLanguage } from '../types';
import {
  X,
  Camera,
  Sparkles,
  Wand2,
  Package,
  CalendarDays,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Wallet,
  Ruler,
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: OutputLanguage;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, language }) => {
  const isBn = language === 'bn';
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      icon: <Camera className="w-6 h-6 text-[#163D32]" />,
      title: isBn ? '১. রুমের ছবি আপলোড ও স্কোরিং' : '1. Scan Any Room Photo',
      desc: isBn
        ? 'যেকোনো রুমের ছবি আপলোড করলে AI ক্লাটার স্কোর, কাজের আনুমানিক সময়, অবজেক্ট ডিটেকশন এবং ধাপে ধাপে প্ল্যান তৈরি করবে।'
        : 'Upload a room photo to receive an instant Clutter Score, object bounding-box detection, furniture feedback, and a prioritized action checklist.',
    },
    {
      icon: <Wand2 className="w-6 h-6 text-[#163D32]" />,
      title: isBn ? '২. AI রুম রিডিজাইন ও আগে-পরে তুলনা' : '2. AI Redesign & Before/After',
      desc: isBn
        ? 'ঘরের কাঠামো ঠিক রেখে ৮টি আধুনিক স্টাইলে নতুন ডিজাইন প্রিভিউ তৈরি করুন এবং গ্যালারিতে সংরক্ষণ করুন।'
        : 'Preview clutter-free room redesigns across 8 curated interior styles, adjust budget & furniture options, and save pairs to your Before & After Gallery.',
    },
    {
      icon: <CalendarDays className="w-6 h-6 text-[#163D32]" />,
      title: isBn ? '৩. স্মার্ট ইনভেন্টরি ও ক্যালেন্ডার' : '3. Inventory & Cleaning Calendar',
      desc: isBn
        ? 'কোন জিনিস কোন তাক বা বক্সে রাখা আছে তা ইনভেন্টরিতে রাখুন এবং সাপ্তাহিক ও মাসিক রিমাইন্ডার সেট করুন।'
        : 'Track exactly where items are stored with AI relocation suggestions, and organize daily tasks in Weekly, Monthly, or List views.',
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-[#163D32]" />,
      title: isBn ? '৪. ভয়েস AI কোচ ও ফ্যামিলি হাব' : '4. Voice AI Coach & Family Hub',
      desc: isBn
        ? '৪টি আলাদা AI কোচের সাথে ভয়েস বা চ্যাটে কথা বলুন এবং পরিবারের সবার মাঝে রুমের দায়িত্ব ভাগ করে নিন।'
        : 'Chat or speak with 4 specialized AI organizer coaches, save conversation threads, and assign rooms to household members.',
    },
    {
      icon: <Wallet className="w-6 h-6 text-[#163D32]" />,
      title: isBn ? '৫. স্মার্ট বাজেট ও AI শপিং গাইড' : '5. Smart Budget & AI Shopping Guide',
      desc: isBn
        ? 'ঘর গোছানোর খরচের লক্ষ্য সেট করুন, প্রতিটি ব্যয় ট্র্যাক করুন এবং স্টোরেজের মাপ, বিকল্প DIY সমাধান ও AI শপিং পরামর্শ নিন।'
        : 'Track declutter spending against a target budget, compare DIY upcycling options, and query our AI Shopping Assistant for exact organizer sizes.',
    },
    {
      icon: <Ruler className="w-6 h-6 text-[#163D32]" />,
      title: isBn ? '৬. ২ডি লেআউট প্ল্যানার, প্ল্যান ও সাপোর্ট' : '6. 2D Layout Planner, Plans & Support',
      desc: isBn
        ? 'সঠিক ফুট/মিটার মাপে ২ডি রুমে আসবাব সাজিয়ে হাঁটার পথ যাচাই করুন, এবং প্রয়োজনে প্ল্যান ও হেল্প সেন্টার দেখুন।'
        : 'Place and rotate scaled furniture in ft/m with automated walkway clearance checks, or visit Plans & Help Support anytime.',
    },
  ];

  const current = steps[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-[#163D32]/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163D32] dark:text-[#E9B95B] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>{isBn ? 'নিটস্পেস AI গাইড' : 'NeatSpace AI Quick Guide'}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="p-1.5 rounded-lg text-[#163D32]/60 dark:text-[#B9D1C3] hover:bg-[#F7F9F6] dark:hover:bg-[#182C24]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#DDF3E5] flex items-center justify-center">
            {current.icon}
          </div>
          <h3 className="text-lg font-bold text-[#163D32] dark:text-[#EDF4EF]">{current.title}</h3>
          <p className="text-xs sm:text-sm text-[#163D32]/80 dark:text-[#B9D1C3] leading-relaxed">
            {current.desc}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                aria-label={`Step ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-[#163D32] dark:bg-[#E9B95B]' : 'w-2 bg-[#163D32]/20 dark:bg-white/20'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32] dark:text-[#EDF4EF] text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{isBn ? 'আগে' : 'Back'}</span>
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#163D32] text-white text-xs font-bold"
              >
                <span>{isBn ? 'পরবর্তী' : 'Next'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E9B95B] text-[#163D32] text-xs font-bold"
              >
                <Package className="w-4 h-4" />
                <span>{isBn ? 'শুরু করুন' : 'Get Started'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
