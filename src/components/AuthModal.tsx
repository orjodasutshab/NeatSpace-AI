import React, { useState, useEffect } from 'react';
import { OutputLanguage } from '../types';
import {
  signInWithGoogle,
  signInWithEmailPassword,
  registerWithEmailPassword,
  sendPasswordReset,
} from '../firebase';
import { X, Mail, Lock, User as UserIcon, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  language: OutputLanguage;
  onClose: () => void;
  onAuthSuccess: (message: string) => void;
}

type AuthTab = 'signin' | 'signup' | 'reset';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  language,
  onClose,
  onAuthSuccess,
}) => {
  const isBn = language === 'bn';
  const [tab, setTab] = useState<AuthTab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setInfo(null);
    }
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const formatAuthError = (err: any): string => {
    const code = String(err?.code || '');
    if (code === 'auth/operation-not-allowed') {
      return isBn
        ? 'Firebase কনসোলে Email/Password সাইন-ইন এখনো সক্রিয় করা হয়নি। এখনই Google দিয়ে সাইন ইন করুন অথবা Firebase Console থেকে Email/Password চালু করুন।'
        : 'Email/Password sign-in is not yet enabled in the Firebase Console. Use Google Sign-In now, or enable Email/Password under Firebase Authentication -> Sign-in method.';
    }
    if (code === 'auth/email-already-in-use') {
      return isBn ? 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট তৈরি করা আছে।' : 'An account with this email already exists.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return isBn ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।' : 'Invalid email or password.';
    }
    if (code === 'auth/weak-password') {
      return isBn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters long.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return isBn ? 'সাইন-ইন পপআপ বন্ধ করা হয়েছিল।' : 'Sign-in popup was closed.';
    }
    return err?.message || (isBn ? 'সাইন ইন করা যায়নি। আবার চেষ্টা করুন।' : 'Authentication failed. Please try again.');
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onAuthSuccess(
        isBn
          ? 'Google সাইন ইন সফল হয়েছে! আপনার ওয়ার্কস্পেস ক্লাউডে সিঙ্ক হচ্ছে।'
          : 'Signed in with Google! Your workspace syncs automatically with Cloud Firestore.'
      );
      onClose();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(formatAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(isBn ? 'ইমেইল লিখুন।' : 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'reset') {
        await sendPasswordReset(cleanEmail);
        setInfo(
          isBn
            ? 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।'
            : 'Password reset email sent! Check your inbox for reset instructions.'
        );
        return;
      }

      if (password.length < 6) {
        setError(isBn ? 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।' : 'Password must be at least 6 characters.');
        return;
      }

      if (tab === 'signup') {
        await registerWithEmailPassword(name.trim() || cleanEmail.split('@')[0], cleanEmail, password);
        onAuthSuccess(
          isBn
            ? 'অ্যাকাউন্ট তৈরি হয়েছে! ক্লাউড সিঙ্ক চালু করতে আপনার ইমেইলে পাঠানো ভেরিফিকেশন লিংকে ক্লিক করুন।'
            : 'Account created! Please click the verification link sent to your email to enable Cloud Firestore sync.'
        );
        onClose();
      } else {
        const cred = await signInWithEmailPassword(cleanEmail, password);
        onAuthSuccess(
          cred.user.emailVerified
            ? isBn
              ? 'সাইন ইন সফল হয়েছে!'
              : 'Welcome back! Signed in cleanly.'
            : isBn
            ? 'সাইন ইন হয়েছে। ক্লাউড সিঙ্কের জন্য অনুগ্রহ করে ইমেইল ভেরিফাই করুন।'
            : 'Signed in! Verify your email address to activate Cloud Firestore writes.'
        );
        onClose();
      }
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#163D32]/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="bg-[#163D32] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DDF3E5] text-[#163D32] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">
                {tab === 'signin'
                  ? isBn
                    ? 'NeatSpace AI-তে সাইন ইন'
                    : 'Sign In to NeatSpace AI'
                  : tab === 'signup'
                  ? isBn
                    ? 'নতুন অ্যাকাউন্ট তৈরি করুন'
                    : 'Create NeatSpace Account'
                  : isBn
                  ? 'পাসওয়ার্ড রিসেট করুন'
                  : 'Reset Your Password'}
              </h2>
              <p className="text-[11px] text-[#DDF3E5]/80">
                {isBn ? 'ক্লাউড সিঙ্ক, রুম প্ল্যান ও সাবস্ক্রিপশন' : 'Sync rooms, layouts & billing across devices'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close auth modal"
            className="p-1.5 rounded-lg hover:bg-white/15 text-[#DDF3E5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Google Sign In Primary CTA */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogle}
            className="w-full py-2.5 px-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/70 border border-[#163D32]/20 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{isBn ? 'Google দিয়ে দ্রুত সাইন ইন করুন' : 'Continue with Google'}</span>
          </button>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-[#163D32]/50 dark:text-[#9FC6B0]">
            <div className="flex-1 h-px bg-[#163D32]/15 dark:bg-[#264638]" />
            <span>{isBn ? 'অথবা ইমেইল ব্যবহার করুন' : 'or use email'}</span>
            <div className="flex-1 h-px bg-[#163D32]/15 dark:bg-[#264638]" />
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-xs font-bold">
            {(
              [
                { id: 'signin', label: isBn ? 'সাইন ইন' : 'Sign In' },
                { id: 'signup', label: isBn ? 'নিবন্ধন' : 'Register' },
                { id: 'reset', label: isBn ? 'রিসেট' : 'Reset' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`py-1.5 rounded-lg transition-colors ${
                  tab === item.id
                    ? 'bg-[#163D32] text-white'
                    : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="p-3 rounded-xl bg-[#DDF3E5] dark:bg-[#1A3329] border border-[#163D32]/20 text-[#163D32] dark:text-[#EDF4EF] text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#163D32] dark:text-[#E9B95B]" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-[#163D32]/80 dark:text-[#B9D1C3] mb-1">
                  {isBn ? 'আপনার নাম' : 'Full Name'}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#163D32]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isBn ? 'আপনার নাম' : 'Alex Morgan'}
                    className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none focus:border-[#163D32]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#163D32]/80 dark:text-[#B9D1C3] mb-1">
                {isBn ? 'ইমেইল ঠিকানা' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#163D32]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none focus:border-[#163D32]"
                />
              </div>
            </div>

            {tab !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-[#163D32]/80 dark:text-[#B9D1C3] mb-1">
                  {isBn ? 'পাসওয়ার্ড' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#163D32]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none focus:border-[#163D32]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#163D32] hover:bg-[#102E25] disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {tab === 'signin'
                  ? isBn
                    ? 'ইমেইল দিয়ে সাইন ইন করুন'
                    : 'Sign In with Email'
                  : tab === 'signup'
                  ? isBn
                    ? 'অ্যাকাউন্ট তৈরি করুন'
                    : 'Create Account'
                  : isBn
                  ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠান'
                  : 'Send Reset Link'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
