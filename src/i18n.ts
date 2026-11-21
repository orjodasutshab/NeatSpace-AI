import { OutputLanguage, RoomType, FocusGoal, RedesignStyle } from './types';

export interface UILabels {
  brandName: string;
  navHome: string;
  navNewPhoto: string;
  navRedesign: string;
  navSavedRooms: string;
  navGallery: string;
  navCalendar: string;
  navInventory: string;
  navStats: string;
  navFamily: string;
  navPlanner: string;
  navBudget: string;
  navPricing: string;
  navSupport: string;
  navAdmin: string;
  navProfile: string;
  navHomeTools: string;
  navAiCoach: string;
  navMore: string;
  navTasksDone: string;
  navSignIn: string;
  navSignOut: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroToolsCta: string;
  uploadTitle: string;
  uploadDesc: string;
  uploadFormats: string;
  uploadCamera: string;
  uploadBigCta: string;
  sampleTitle: string;
  sampleHint: string;
  changePhoto: string;
  step1Label: string;
  step2Label: string;
  step3ContextLabel: string;
  step3ContextPlaceholder: string;
  dailyBudgetLabel: string;
  langLabel: string;
  analyzeButton: string;
  analyzingButton: string;
  uploadPromptHint: string;
  coachFloating: string;
  tabPlan: string;
  tabObjects: string;
  tabBeforeAfter: string;
  tabTriage: string;
  tabWins: string;
  tabProblems: string;
  tabSpaceColor: string;
  tabStorage: string;
  tabLayout: string;
  exportPdf: string;
  stuckPickForMe: string;
  roomLabels: Record<RoomType, string>;
  goalLabels: Record<FocusGoal, { label: string; description: string }>;
  redesignStyles: Record<RedesignStyle, { label: string; desc: string }>;
}

const EN_LABELS: UILabels = {
  brandName: 'NeatSpace AI',
  navHome: 'Dashboard',
  navNewPhoto: 'Room Analyzer',
  navRedesign: 'AI Redesign',
  navSavedRooms: 'My Rooms',
  navGallery: 'Before & After',
  navCalendar: 'Calendar & Reminders',
  navInventory: 'Storage Inventory',
  navStats: 'Stats & Rewards',
  navFamily: 'Family Hub',
  navPlanner: '2D Room Planner',
  navBudget: 'Budget & Shopping',
  navPricing: 'Plans & Billing',
  navSupport: 'Help & Support',
  navAdmin: 'Admin Console',
  navProfile: 'Profile & Settings',
  navHomeTools: 'Power Tools',
  navAiCoach: 'AI Coach',
  navMore: 'More',
  navTasksDone: 'tasks done',
  navSignIn: 'Sign In',
  navSignOut: 'Sign Out',
  heroKicker: 'AI Home Organization & Redesign Workspace',
  heroTitle: 'Turn Room Chaos into Calm, Organized Living',
  heroSubtitle:
    'Upload a room photo for instant object detection, AI room redesigns, clutter scoring, space utilization, color palettes, and voice-guided action plans.',
  heroToolsCta: 'Open Power Tools (2D Floorplan · Bin Labels · Seasonal · Budget)',
  uploadTitle: 'Upload Room Photo',
  uploadDesc: 'Drag & drop a photo of your room, browse files, or paste from clipboard.',
  uploadFormats: 'Supports JPG, PNG, WEBP & HEIC',
  uploadCamera: 'Take Photo',
  uploadBigCta: 'Upload Room Photo',
  sampleTitle: 'Try a Sample Room',
  sampleHint: 'Click any room to load photo',
  changePhoto: 'Change Photo',
  step1Label: '1. Select Room Category',
  step2Label: '2. Select Primary Declutter Goal',
  step3ContextLabel: '3. Extra Constraints or Focus Notes (Optional)',
  step3ContextPlaceholder: 'e.g. Rental apartment (no drilling), shared desk, keep storage under $20...',
  dailyBudgetLabel: 'Daily Time Budget',
  langLabel: 'App & Plan Language',
  analyzeButton: 'Analyze Room & Build Plan',
  analyzingButton: 'Analyzing Room Photo...',
  uploadPromptHint: 'Upload a room photo or select a sample room to begin analysis',
  coachFloating: 'Voice Coach',
  tabPlan: 'Action Plan',
  tabObjects: 'Object Detection',
  tabBeforeAfter: 'Before & After',
  tabTriage: 'Triage & Eco',
  tabWins: 'Quick Wins',
  tabProblems: 'Problem Areas',
  tabSpaceColor: 'Space & Colors',
  tabStorage: 'Storage Shop',
  tabLayout: 'Layout & Routine',
  exportPdf: 'Export PDF',
  stuckPickForMe: 'Stuck? Pick for me',
  roomLabels: {
    living_room: 'Living Room',
    bedroom: 'Bedroom',
    home_office: 'Home Office',
    kitchen: 'Kitchen',
    dining_room: 'Dining Room',
    closet: 'Closet',
    bathroom: 'Bathroom',
    garage: 'Garage',
    kids_room: 'Kids Room',
    general: 'General Room',
  },
  goalLabels: {
    quick_wins: {
      label: '15-Min Quick Wins',
      description: 'Immediate 5-10 minute tasks to make an instant visual impact.',
    },
    maximize_space: {
      label: 'Maximize Space & Flow',
      description: 'Optimize layout, walkways, and free up counter/floor surfaces.',
    },
    storage_solutions: {
      label: 'Storage & Zoning',
      description: 'Get smart container, shelving, and vertical storage recommendations.',
    },
    aesthetic_reset: {
      label: 'Aesthetic Reset',
      description: 'Harmonize colors, organize open shelves, and create visual peace.',
    },
    deep_declutter: {
      label: 'Deep Purge & Reset',
      description: 'Comprehensive step-by-step audit to categorize, sort, and purge.',
    },
  },
  redesignStyles: {
    minimalist: { label: 'Minimalist', desc: 'Crisp clutter-free surfaces & calm breathing room' },
    scandinavian: { label: 'Scandinavian', desc: 'Light oak furniture, soft whites & cozy textiles' },
    modern: { label: 'Modern', desc: 'Clean architectural lines & sleek hidden storage' },
    luxury: { label: 'Luxury', desc: 'Refined warm brass, tailored drapery & curated decor' },
    bohemian: { label: 'Bohemian', desc: 'Woven textures, warm earth tones & indoor plants' },
    japandi: { label: 'Japandi', desc: 'Natural bamboo harmony & serene zen order' },
    industrial: { label: 'Industrial', desc: 'Matte metal shelving, warm timber & loft utility' },
    contemporary: { label: 'Contemporary', desc: 'Balanced tonal palette & effortless organization' },
    cozy_modern: { label: 'Cozy Modern', desc: 'Balanced lighting, sage accents & tidy shelving' },
    warm_earth: { label: 'Warm Botanical', desc: 'Indoor plants, woven baskets & earthy tones' },
    budget_refresh: { label: 'Budget Refresh', desc: 'Keep existing furniture, smart reorganization' },
  },
};

const BN_LABELS: UILabels = {
  brandName: 'নিটস্পেস AI',
  navHome: 'ড্যাশবোর্ড',
  navNewPhoto: 'রুম বিশ্লেষণ',
  navRedesign: 'AI রিডিজাইন',
  navSavedRooms: 'আমার রুমসমূহ',
  navGallery: 'আগে ও পরে গ্যালারি',
  navCalendar: 'ক্যালেন্ডার ও রিমাইন্ডার',
  navInventory: 'স্টোরেজ ইনভেন্টরি',
  navStats: 'অগ্রগতি ও রিওয়ার্ড',
  navFamily: 'ফ্যামিলি হাব',
  navPlanner: '২ডি রুম প্ল্যানার',
  navBudget: 'বাজেট ও শপিং',
  navPricing: 'প্ল্যান ও বিলিং',
  navSupport: 'হেল্প ও সাপোর্ট',
  navAdmin: 'অ্যাডমিন কনসোল',
  navProfile: 'প্রোফাইল ও সেটিংস',
  navHomeTools: 'পাওয়ার টুলস',
  navAiCoach: 'ভয়েস AI কোচ',
  navMore: 'আরও টুলস',
  navTasksDone: 'কাজ সম্পন্ন',
  navSignIn: 'সাইন ইন',
  navSignOut: 'সাইন আউট',
  heroKicker: 'AI রুম অর্গানাইজার ও রিডিজাইন স্টুডিও',
  heroTitle: 'অগোছালো ঘরকে সাজিয়ে নিন সুন্দর, শান্ত পরিবেশে',
  heroSubtitle:
    'ছবি আপলোড করে পান অবজেক্ট ডিটেকশন, AI রুম রিডিজাইন প্রিভিউ, ক্লাটার স্কোর, জায়গার স্মার্ট ব্যবহার, রঙের পরামর্শ এবং ভয়েস AI কোচ।',
  heroToolsCta: 'পাওয়ার টুলস খুলুন (২ডি ফ্লোরপ্ল্যান · বক্স লেবেল · সিজনাল · বাজেট)',
  uploadTitle: 'ঘরের ছবি আপলোড করুন',
  uploadDesc: 'ছবি ড্র্যাগ করে ছাড়ুন, ফাইল বেছে নিন বা ক্লিপবোর্ড থেকে পেস্ট করুন।',
  uploadFormats: 'JPG, PNG, WEBP ও HEIC সাপোর্ট করে',
  uploadCamera: 'ক্যামেরা দিয়ে তুলুন',
  uploadBigCta: 'ঘরের ছবি আপলোড করুন',
  sampleTitle: 'স্যাম্পল রুম দিয়ে দেখুন',
  sampleHint: 'যেকোনো রুমের ছবিতে ক্লিক করুন',
  changePhoto: 'ছবি বদলান',
  step1Label: '১. ঘরের ধরন বেছে নিন',
  step2Label: '২. প্রধান লক্ষ্য নির্বাচন করুন',
  step3ContextLabel: '৩. বিশেষ শর্ত বা নোট (ঐচ্ছিক)',
  step3ContextPlaceholder: 'যেমন: ভাড়া বাসা (দেয়ালে ছিদ্র করা যাবে না), বাজেট কম, কেবল গোছাতে চাই...',
  dailyBudgetLabel: 'দৈনিক সময় বরাদ্দ',
  langLabel: 'অ্যাপ ও প্ল্যানের ভাষা',
  analyzeButton: 'রুম বিশ্লেষণ ও প্ল্যান তৈরি করুন',
  analyzingButton: 'ছবি বিশ্লেষণ করা হচ্ছে...',
  uploadPromptHint: 'শুরু করতে একটি ছবি আপলোড করুন বা স্যাম্পল রুম বেছে নিন',
  coachFloating: 'ভয়েস কোচ',
  tabPlan: 'অ্যাকশন প্ল্যান',
  tabObjects: 'অবজেক্ট ডিটেকশন',
  tabBeforeAfter: 'আগে ও পরে',
  tabTriage: 'বাছাই ও রিসাইকেল',
  tabWins: 'দ্রুত সমাধান',
  tabProblems: 'সমস্যার জোন',
  tabSpaceColor: 'স্পেস ও রঙ',
  tabStorage: 'স্টোরেজ শপিং',
  tabLayout: 'লেআউট ও রুটিন',
  exportPdf: 'PDF ডাউনলোড',
  stuckPickForMe: 'বুঝতে পারছি না? একটি কাজ দিন',
  roomLabels: {
    living_room: 'বসার ঘর',
    bedroom: 'শোবার ঘর',
    home_office: 'হোম অফিস',
    kitchen: 'রান্নাঘর',
    dining_room: 'ডাইনিং রুম',
    closet: 'আলমারি / ক্লোজেট',
    bathroom: 'বাথরুম',
    garage: 'গ্যারেজ / স্টোর',
    kids_room: 'বাচ্চাদের ঘর',
    general: 'সাধারণ ঘর',
  },
  goalLabels: {
    quick_wins: {
      label: '১৫ মিনিটে দ্রুত সমাধান',
      description: 'তাৎক্ষণিক পরিবর্তন আনতে ৫–১০ মিনিটের সহজ কাজ।',
    },
    maximize_space: {
      label: 'জায়গা ও চলাচল বাড়ান',
      description: 'হাঁটার পথ ও মেঝে-টেবিল ফাঁকা করতে স্মার্ট লেআউট।',
    },
    storage_solutions: {
      label: 'স্টোরেজ ও জোনিং',
      description: 'বক্স, শেল্ফ ও ভার্টিক্যাল স্টোরেজের কার্যকর পরামর্শ।',
    },
    aesthetic_reset: {
      label: 'দৃষ্টিনন্দন রিসেট',
      description: 'রঙের সামঞ্জস্য ও খোলা তাক গুছিয়ে শান্ত পরিবেশ তৈরি।',
    },
    deep_declutter: {
      label: 'গভীর পরিচ্ছন্নতা ও ছাঁটাই',
      description: 'অপ্রয়োজনীয় জিনিস বাছাই, দান ও পুরো ঘর রিসেটের ধাপ।',
    },
  },
  redesignStyles: {
    minimalist: { label: 'মিনিমালিস্ট', desc: 'খোলামেলা, পরিচ্ছন্ন ও শান্ত ডিজাইন' },
    scandinavian: { label: 'স্ক্যান্ডিনেভিয়ান', desc: 'হালকা কাঠ, সাদা দেয়াল ও আরামদায়ক টেক্সচার' },
    modern: { label: 'মডার্ন', desc: 'আধুনিক লাইন ও স্মার্ট হিডেন স্টোরেজ' },
    luxury: { label: 'লাক্সারি', desc: 'উষ্ণ সোনালি ছোঁয়া ও মার্জিত আসবাব' },
    bohemian: { label: 'বোহেমিয়ান', desc: 'বেতের ঝুড়ি, মাটির রঙ ও ইনডোর গাছ' },
    japandi: { label: 'জাপান্ডি', desc: 'প্রাকৃতিক বাঁশ-কাঠ ও ভারসাম্যপূর্ণ প্রশান্তি' },
    industrial: { label: 'ইন্ডাস্ট্রিয়াল', desc: 'মেটাল শেল্ফ ও স্টাইলিশ লফট লুক' },
    contemporary: { label: 'কনটেম্পোরারি', desc: 'নরম রঙের সমন্বয় ও ছিমছাম সাজসজ্জা' },
    cozy_modern: { label: 'কোজি মডার্ন', desc: 'নরম আলো, সবুজ ছোঁয়া ও গোছানো তাক' },
    warm_earth: { label: 'বোটানিক্যাল হোম', desc: 'ইনডোর গাছ, বেতের ঝুড়ি ও মাটির রঙ' },
    budget_refresh: { label: 'বাজেট রিফ্রেশ', desc: 'আগের আসবাব রেখেই নতুনভাবে সাজানো' },
  },
};

export function getUILabels(lang: OutputLanguage): UILabels {
  return lang === 'bn' ? BN_LABELS : EN_LABELS;
}
