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
    'à¦¹à§à¦¯à¦¾à¦²à§‹! à¦†à¦®à¦¿ à¦†à¦ªà¦¨à¦¾à¦° à¦®à¦¿à¦¨à¦¿à¦®à¦¾à¦²à¦¿à¦¸à§à¦Ÿ AI à¦•à§‹à¦šà¥¤ à¦†à¦œ à¦†à¦ªà¦¨à¦¾à¦° à¦˜à¦°à¦•à§‡ à¦•à§€à¦­à¦¾à¦¬à§‡ à¦¶à¦¾à¦¨à§à¦¤ à¦“ à¦ªà¦°à¦¿à¦ªà¦¾à¦Ÿà¦¿ à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¿?',
  speed_cleaner:
    'à¦šà¦²à§à¦¨ à§§à§« à¦®à¦¿à¦¨à¦¿à¦Ÿà§‡à¦° à¦¸à§à¦ªà¦¿à¦¡ à¦•à§à¦²à¦¿à¦¨à¦¿à¦‚ à¦¶à§à¦°à§ à¦•à¦°à¦¿! à¦•à§‹à¦¨ à¦œà¦¾à§Ÿà¦—à¦¾à¦Ÿà¦¿ à¦¦à¦¿à§Ÿà§‡ à¦†à¦œ à¦¶à§à¦°à§ à¦•à¦°à¦¤à§‡ à¦šà¦¾à¦¨?',
  budget_diy:
    'à¦¹à§à¦¯à¦¾à¦²à§‹! à¦¬à¦¾à§œà¦¤à¦¿ à¦–à¦°à¦š à¦›à¦¾à§œà¦¾à¦‡ à¦˜à¦°à§‡à¦° à¦œà¦¿à¦¨à¦¿à¦¸ à¦¦à¦¿à§Ÿà§‡ à¦¸à§à¦®à¦¾à¦°à§à¦Ÿ à¦¸à§à¦Ÿà§‹à¦°à§‡à¦œ à¦¬à¦¾à¦¨à¦¾à¦¤à§‡ à¦šà¦¾à¦‡à¦²à§‡ à¦†à¦®à¦¾à¦•à§‡ à¦œà¦¿à¦œà§à¦žà§‡à¦¸ à¦•à¦°à§à¦¨!',
  feng_shui:
    'à¦¸à§à¦¬à¦¾à¦—à¦¤à¦®à¥¤ à¦šà¦²à§à¦¨ à¦†à¦ªà¦¨à¦¾à¦° à¦˜à¦°à§‡à¦° à¦†à¦²à§‹, à¦šà¦²à¦¾à¦šà¦²à§‡à¦° à¦ªà¦¥ à¦à¦¬à¦‚ à¦ªà§à¦°à¦¶à¦¾à¦¨à§à¦¤à¦¿à¦° à¦­à¦¾à¦°à¦¸à¦¾à¦®à§à¦¯ à¦ à¦¿à¦• à¦•à¦°à¦¿à¥¤',
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
          'à¦•à§‹à¦¥à¦¾ à¦¥à§‡à¦•à§‡ à¦—à§‹à¦›à¦¾à¦¨à§‹ à¦¶à§à¦°à§ à¦•à¦°à¦¬?',
          'à§§à§¦ à¦®à¦¿à¦¨à¦¿à¦Ÿà§‡à¦° à¦à¦•à¦Ÿà¦¿ à¦ªà§à¦²à§à¦¯à¦¾à¦¨ à¦¦à¦¿à¦¨',
          'à¦†à¦œà¦•à§‡à¦° à¦®à§‹à¦Ÿà¦¿à¦­à§‡à¦¶à¦¨à¦¾à¦² à¦Ÿà¦¿à¦ªà¦¸ à¦¦à¦¿à¦¨',
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
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#â€¢]/g, ' '));
    utterance.lang = isBn ? 'bn-BD' : 'en-US';
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoice = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
