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
  heroToolsCta: 'Open Power Tools (2D Floorplan Â· Bin Labels Â· Seasonal Â· Budget)',
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
