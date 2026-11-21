import React, { useState, useRef, useEffect } from 'react';
import {
  ChatMessage,
  CoachConversation,
  CoachPersona,
  CoachPersonaDetails,
  OutputLanguage,
  RoomAnalysis,
} from '../types';
import {
  Send,
  X,
  Loader2,
  RotateCcw,
  Mic,
  MicOff,
  Compass,
  Zap,
  Wrench,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Square,
  History,
  MessageSquarePlus,
  Trash2,
} from 'lucide-react';

interface DeclutterChatProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoom: RoomAnalysis | null;
  language?: OutputLanguage;
  embedded?: boolean;
  userStats?: {
    completedSteps: number;
    savedRoomsCount: number;
    focusMinutesTotal: number;
  };
  onBeforeSendMessage?: () => string | null;
  onMessageComplete?: () => void;
}

const THREADS_STORAGE_KEY = 'neatspace_coach_threads';

const PERSONAS: CoachPersonaDetails[] = [
  {
    id: 'minimalist',
    name: 'Marie / Minimalist',
    role: 'KonMari & Minimalist Coach',
    description: 'Calm, intentional advice focused on keeping what brings genuine value.',
    avatarIcon: 'minimalist',
    greeting:
      "Hello! I'm your Minimalist Organization Coach. How can we make your room feel peaceful and spacious today?",
  },
  {
    id: 'speed_cleaner',
    name: 'Flash Blitz',
    role: '15-Min Speed Declutterer',
    description: 'High-energy, fast-paced timers and instant 5-minute action blitzes.',
    avatarIcon: 'speed_cleaner',
    greeting: "Let's speed-run this decluttering! What spot should we tackle in the next 15 minutes?",
  },
  {
    id: 'budget_diy',
    name: 'Handy DIYer',
    role: 'Budget & Upcycling Hack Expert',
    description: 'Clever storage hacks using shoeboxes, tension rods, and zero-cost ideas.',
    avatarIcon: 'budget_diy',
    greeting: 'Hey there! Ready to organize without spending extra? Ask me for budget-friendly hacks!',
  },
  {
    id: 'feng_shui',
    name: 'Master Lin',
    role: 'Feng Shui & Flow Consultant',
    description: 'Harmonize room energy, light, entryways, and functional layout.',
    avatarIcon: 'feng_shui',
    greeting: 'Greetings. Let us balance natural light, walkways, and calm flow in your space.',
  },
];

const BN_GREETINGS: Record<CoachPersona, string> = {
  minimalist:
    'হ্যালো! আমি আপনার মিনিমালিস্ট AI কোচ। আজ আপনার ঘরকে কীভাবে শান্ত ও পরিপাটি করতে পারি?',
  speed_cleaner:
    'চলুন ১৫ মিনিটের স্পিড ক্লিনিং শুরু করি! কোন জায়গাটি দিয়ে আজ শুরু করতে চান?',
  budget_diy:
    'হ্যালো! বাড়তি খরচ ছাড়াই ঘরের জিনিস দিয়ে স্মার্ট স্টোরেজ বানাতে চাইলে আমাকে জিজ্ঞেস করুন!',
  feng_shui:
    'স্বাগতম। চলুন আপনার ঘরের আলো, চলাচলের পথ এবং প্রশান্তির ভারসাম্য ঠিক করি।',
};

function renderPersonaIcon(id: CoachPersona) {
  switch (id) {
    case 'speed_cleaner':
      return <Zap className="w-4 h-4 text-[#E9B95B]" />;
    case 'budget_diy':
      return <Wrench className="w-4 h-4 text-[#163D32]" />;
    case 'feng_shui':
      return <Compass className="w-4 h-4 text-[#163D32]" />;
    default:
      return <Sparkles className="w-4 h-4 text-[#163D32]" />;
  }
}

function loadThreads(): CoachConversation[] {
  try {
    const raw = localStorage.getItem(THREADS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CoachConversation[]) : [];
  } catch {
    return [];
  }
}

export const DeclutterChat: React.FC<DeclutterChatProps> = ({
  isOpen,
  onClose,
  activeRoom,
  language = 'en',
  embedded = false,
  userStats,
  onBeforeSendMessage,
  onMessageComplete,
}) => {
  const isBn = language === 'bn';
  const [selectedPersona, setSelectedPersona] = useState<CoachPersona>('minimalist');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const [threads, setThreads] = useState<CoachConversation[]>(() => loadThreads());
  const [activeThreadId, setActiveThreadId] = useState<string>(() => `thr_${Date.now()}`);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const currentPersona = PERSONAS.find((p) => p.id === selectedPersona) || PERSONAS[0];

  const getDefaultReplies = () =>
    isBn
      ? [
          'কোথা থেকে গোছানো শুরু করব?',
          '১০ মিনিটের একটি প্ল্যান দিন',
          'আজকের মোটিভেশনাল টিপস দিন',
        ]
      : [
          'Where do I start decluttering?',
          'Give me a 10-minute speed plan',
          'Motivational tip for my habit',
        ];

  const getGreetingText = (personaId: CoachPersona) =>
    isBn
      ? BN_GREETINGS[personaId]
      : (PERSONAS.find((p) => p.id === personaId) || PERSONAS[0]).greeting;

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg_welcome',
          sender: 'assistant',
          text: getGreetingText(selectedPersona),
          timestamp: Date.now(),
          quickReplies: getDefaultReplies(),
        },
      ]);
    }
  }, [selectedPersona, language]);

  useEffect(() => {
    if (isOpen || embedded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, embedded]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const persistThreads = (next: CoachConversation[]) => {
    setThreads(next);
    try {
      localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(next.slice(0, 20)));
    } catch {
      // ignore
    }
  };

  const saveCurrentConversation = (msgs: ChatMessage[], persona: CoachPersona) => {
    const firstUserMsg = msgs.find((m) => m.sender === 'user');
    if (!firstUserMsg) return;
    const title = firstUserMsg.text.slice(0, 48);
    const entry: CoachConversation = {
      id: activeThreadId,
      title,
      persona,
      roomName: activeRoom?.roomName,
      updatedAt: Date.now(),
      messages: msgs.slice(-30),
    };
    const next = [entry, ...threads.filter((t) => t.id !== activeThreadId)].slice(0, 20);
    persistThreads(next);
  };

  if (!embedded && !isOpen) return null;

  const speakMessage = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#•]/g, ' '));
    utterance.lang = isBn ? 'bn-BD' : 'en-US';
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoice = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = isBn ? 'bn-BD' : 'en-US';
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const handleStartNewThread = (personaOverride?: CoachPersona) => {
    const p = personaOverride || selectedPersona;
    setActiveThreadId(`thr_${Date.now()}`);
    setMessages([
      {
        id: 'msg_reset_' + Date.now(),
        sender: 'assistant',
        text: getGreetingText(p),
        timestamp: Date.now(),
        quickReplies: getDefaultReplies(),
      },
    ]);
    setShowHistory(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isLoading) return;

    const gateError = onBeforeSendMessage?.();
    if (gateError) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'gate_' + Date.now(),
          sender: 'assistant',
          text: gateError,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: query.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);
    saveCurrentConversation(newMessages, selectedPersona);

    try {
      const send = async () => {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ sender: m.sender, text: m.text })),
            persona: selectedPersona,
            language,
            userStats,
            roomContext: activeRoom
              ? {
                  roomName: activeRoom.roomName,
                  roomType: activeRoom.roomType,
                  clutterScore: activeRoom.clutterScore,
                  problemAreas: activeRoom.problemAreas,
                }
              : null,
          }),
        });
        const rawText = await res.text();
        return { res, rawText };
      };

      let result = await send();
      if (result.rawText.trim().startsWith('<')) {
        await new Promise((r) => setTimeout(r, 3000));
        result = await send();
      }

      let data: any = null;
      try {
        data = JSON.parse(result.rawText);
      } catch {
        throw new Error(
          result.rawText.trim().startsWith('<')
            ? 'Server is warming up. Please try again in a few seconds.'
            : 'Received an unexpected response from the server.'
        );
      }

      if (result.res.ok && data.success && data.message) {
        const updated = [...newMessages, data.message];
        setMessages(updated);
        saveCurrentConversation(updated, selectedPersona);
        onMessageComplete?.();
        if (autoSpeak) {
          speakMessage(data.message.id, data.message.text);
        }
      } else {
        throw new Error(data.details || data.error || 'Failed to get AI response');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: err?.message
            ? `Unable to reply right now: ${err.message}`
            : "I'm having trouble connecting right now. Please try again in a moment!",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasSpeechSupport =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition
    );

  const hasTtsSupport = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const containerClass = embedded
    ? 'w-full h-full bg-white dark:bg-[#13241D] border-l border-[#163D32]/10 dark:border-[#264638] flex flex-col'
    : 'fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white dark:bg-[#13241D] border-l border-[#163D32]/15 dark:border-[#264638] shadow-2xl flex flex-col';

  return (
    <div className={containerClass}>
      {/* Header Bar */}
      <div className="px-4 py-3.5 bg-[#163D32] text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#DDF3E5] flex items-center justify-center shrink-0">
            {renderPersonaIcon(selectedPersona)}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm truncate">{currentPersona.name}</h3>
            <p className="text-[11px] text-[#DDF3E5]/80 truncate">
              {isBn ? 'ভয়েস AI কোচ' : currentPersona.role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            title={isBn ? 'আগের চ্যাট ইতিহাস' : 'Conversation history'}
            className={`p-1.5 rounded-lg border transition-colors ${
              showHistory
                ? 'bg-[#E9B95B] text-[#163D32] border-[#E9B95B]'
                : 'bg-white/10 text-white hover:bg-white/20 border-white/15'
            }`}
          >
            <History className="w-4 h-4" />
          </button>

          {hasTtsSupport && (
            <button
              type="button"
              onClick={() => {
                if (autoSpeak && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  setSpeakingMsgId(null);
                }
                setAutoSpeak((v) => !v);
              }}
              title={autoSpeak ? 'Mute auto voice reply' : 'Auto-speak coach replies'}
              className={`p-1.5 rounded-lg border transition-colors ${
                autoSpeak
                  ? 'bg-[#E9B95B] text-[#163D32] border-[#E9B95B]'
                  : 'bg-white/10 text-white hover:bg-white/20 border-white/15'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleStartNewThread()}
            title={isBn ? 'নতুন চ্যাট' : 'New thread'}
            className="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/15 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {(!embedded || isOpen) && (
            <button
              type="button"
              onClick={onClose}
              title={isBn ? 'বন্ধ করুন' : 'Close AI Coach'}
              aria-label="Close coach chat"
              className="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/15 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Persona Switcher Strip */}
      <div className="p-2.5 bg-[#F7F9F6] dark:bg-[#182C24] border-b border-[#163D32]/10 dark:border-[#264638] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSelectedPersona(p.id);
              handleStartNewThread(p.id);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
              selectedPersona === p.id
                ? 'bg-[#DDF3E5] text-[#163D32] border-[#163D32]/40'
                : 'bg-white dark:bg-[#13241D] text-[#163D32]/70 dark:text-[#B9D1C3] hover:text-[#163D32] border-[#163D32]/10 dark:border-[#264638]'
            }`}
          >
            {renderPersonaIcon(p.id)}
            <span>{p.name.split('/')[0].trim()}</span>
          </button>
        ))}
      </div>

      {/* Active Room Context Banner */}
      {activeRoom && (
        <div className="px-4 py-2 bg-[#DDF3E5]/60 dark:bg-[#1A3329] border-b border-[#163D32]/10 dark:border-[#264638] text-xs text-[#163D32] dark:text-[#EDF4EF] flex items-center justify-between shrink-0 tabular-nums">
          <span className="truncate">
            {isBn ? 'রুম:' : 'Room:'} <strong>{activeRoom.roomName}</strong> · {activeRoom.clutterScore}/100
          </span>
        </div>
      )}

      {/* Conversation History Drawer */}
      {showHistory ? (
        <div className="flex-1 p-4 overflow-y-auto bg-[#F7F9F6] dark:bg-[#0D1A15] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#163D32]/70 dark:text-[#9FC6B0]">
              {isBn ? 'সংরক্ষিত কথোপকথন' : 'Saved Conversations'} ({threads.length})
            </h4>
            <button
              type="button"
              onClick={() => handleStartNewThread()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#163D32] text-white text-xs font-bold"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>{isBn ? 'নতুন চ্যাট' : 'New Chat'}</span>
            </button>
          </div>

          {threads.length === 0 ? (
            <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-8 text-center">
              {isBn
                ? 'কোচের সাথে চ্যাট শুরু করলে কথোপকথন এখানে সংরক্ষিত থাকবে।'
                : 'Your past AI Coach sessions will appear here automatically.'}
            </p>
          ) : (
            <div className="space-y-2">
              {threads.map((thr) => (
                <div
                  key={thr.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    thr.id === activeThreadId
                      ? 'bg-[#DDF3E5]/70 dark:bg-[#1A3329] border-[#163D32]/35'
                      : 'bg-white dark:bg-[#13241D] border-[#163D32]/10 dark:border-[#264638]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveThreadId(thr.id);
                      setSelectedPersona(thr.persona);
                      setMessages(thr.messages);
                      setShowHistory(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                      {thr.title}
                    </div>
                    <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0] truncate">
                      {thr.persona.replace(/_/g, ' ')}
                      {thr.roomName ? ` · ${thr.roomName}` : ''} ·{' '}
                      {new Date(thr.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => persistThreads(threads.filter((x) => x.id !== thr.id))}
                    aria-label="Delete thread"
                    className="p-1.5 text-[#163D32]/45 hover:text-rose-600 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Message List */
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[#F7F9F6]/80 dark:bg-[#0D1A15]">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSpeakingThis = speakingMsgId === msg.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#163D32] text-white font-medium rounded-tr-none'
                      : 'bg-white dark:bg-[#13241D] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/10 dark:border-[#264638] rounded-tl-none shadow-2xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {!isUser && hasTtsSupport && (
                    <div className="mt-2 pt-1.5 border-t border-[#163D32]/10 dark:border-[#264638] flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => speakMessage(msg.id, msg.text)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] hover:text-[#163D32]"
                      >
                        {isSpeakingThis ? (
                          <>
                            <Square className="w-3 h-3" />
                            <span>{isBn ? 'থামান' : 'Stop'}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>{isBn ? 'শুনুন' : 'Listen'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {!isUser && msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[92%]">
                    {msg.quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(reply)}
                        className="text-xs bg-white dark:bg-[#13241D] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/15 dark:border-[#264638] px-3 py-1.5 rounded-xl transition-colors text-left font-medium"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#163D32]/70 dark:text-[#B9D1C3] bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] p-3 rounded-2xl w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-[#163D32] dark:text-[#E9B95B]" />
              <span>
                {currentPersona.name} {isBn ? 'উত্তর লিখছেন...' : 'is replying...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 bg-white dark:bg-[#13241D] border-t border-[#163D32]/10 dark:border-[#264638] shrink-0 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                isBn
                  ? 'আমার রুম ও কাজের অভ্যাসের ওপর ভিত্তি করে একটি অনুপ্রেরণামূলক টিপস দিন।'
                  : 'Give me a personalized motivational tip based on my progress!'
              )
            }
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#DDF3E5] text-[#163D32] whitespace-nowrap shrink-0 hover:bg-[#cdebd8]"
          >
            {isBn ? 'মোটিভেশন টিপস' : 'Motivational Tip'}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                isBn
                  ? 'ঘরের অপ্রয়োজনীয় জিনিস দান বা রিসাইকেল করার সহজ উপায় বলুন।'
                  : 'Suggest smart donation & eco-recycling ideas for my clutter.'
              )
            }
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/80 dark:text-[#EDF4EF] border border-[#163D32]/10 dark:border-[#264638] whitespace-nowrap shrink-0 hover:bg-[#DDF3E5]"
          >
            {isBn ? 'ডোনেশন আইডিয়া' : 'Eco & Donate'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isBn ? 'AI কোচকে কিছু জিজ্ঞেস করুন...' : `Ask ${currentPersona.name}...`}
            className="flex-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] focus:border-[#163D32] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] placeholder-[#163D32]/45 dark:placeholder-[#9FC6B0]/60 outline-none transition-colors"
          />
          {hasSpeechSupport && (
            <button
              type="button"
              onClick={handleToggleVoice}
              title={isListening ? 'Stop voice input' : 'Voice dictation'}
              className={`p-2.5 rounded-xl border transition-colors ${
                isListening
                  ? 'bg-rose-50 text-rose-600 border-rose-300'
                  : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32] dark:text-[#EDF4EF] border-[#163D32]/15 dark:border-[#264638] hover:bg-[#DDF3E5]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-[#163D32] hover:bg-[#102E25] disabled:bg-slate-200 dark:disabled:bg-[#182C24] text-white disabled:text-slate-400 rounded-xl font-bold transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
