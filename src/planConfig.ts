import { PlanTier, SystemConfigSettings } from './types';

export interface PlanQuotaSpec {
  tier: PlanTier;
  name: string;
  nameBn: string;
  audience: string;
  audienceBn: string;
  monthlyPriceUsd: number;
  annualMonthlyPriceUsd: number;
  annualTotalUsd: number;
  monthlyRoomAnalyses: number;
  monthlyRedesigns: number;
  monthlyCoachMessages: number;
  maxSavedRooms: number;
  maxRoomLayouts: number;
  pdfReports: boolean;
  advancedAnalytics: boolean;
  familyCollaboration: boolean;
  shoppingAssistant: boolean;
  priorityFeatures: boolean;
}

export const PLAN_SPECS: Record<PlanTier, PlanQuotaSpec> = {
  free: {
    tier: 'free',
    name: 'Free Starter',
    nameBn: 'ফ্রি স্টার্টার',
    audience: 'For single-room resets & personal trial',
    audienceBn: 'একটি রুম গুছিয়ে শুরু করার জন্য',
    monthlyPriceUsd: 0,
    annualMonthlyPriceUsd: 0,
    annualTotalUsd: 0,
    monthlyRoomAnalyses: 5,
    monthlyRedesigns: 2,
    monthlyCoachMessages: 30,
    maxSavedRooms: 3,
    maxRoomLayouts: 2,
    pdfReports: false,
    advancedAnalytics: false,
    familyCollaboration: false,
    shoppingAssistant: true,
    priorityFeatures: false,
  },
  pro: {
    tier: 'pro',
    name: 'Pro Organizer',
    nameBn: 'প্রো অর্গানাইজার',
    audience: 'For multi-room homes & regular redesigns',
    audienceBn: 'সম্পূর্ণ বাসা ও নিয়মিত রিডিজাইনের জন্য',
    monthlyPriceUsd: 15,
    annualMonthlyPriceUsd: 12.5,
    annualTotalUsd: 150,
    monthlyRoomAnalyses: 40,
    monthlyRedesigns: 20,
    monthlyCoachMessages: 250,
    maxSavedRooms: 30,
    maxRoomLayouts: 15,
    pdfReports: true,
    advancedAnalytics: true,
    familyCollaboration: false,
    shoppingAssistant: true,
    priorityFeatures: false,
  },
  premium: {
    tier: 'premium',
    name: 'Premium Household',
    nameBn: 'প্রিমিয়াম হাউসহোল্ড',
    audience: 'For families, whole-home planning & priority AI',
    audienceBn: 'পরিবার, সম্পূর্ণ প্ল্যানিং ও প্রাইওরিটি AI-এর জন্য',
    monthlyPriceUsd: 25,
    annualMonthlyPriceUsd: 20.83,
    annualTotalUsd: 250,
    monthlyRoomAnalyses: 200,
    monthlyRedesigns: 100,
    monthlyCoachMessages: 1000,
    maxSavedRooms: 200,
    maxRoomLayouts: 100,
    pdfReports: true,
    advancedAnalytics: true,
    familyCollaboration: true,
    shoppingAssistant: true,
    priorityFeatures: true,
  },
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfigSettings = {
  maintenanceMode: false,
  announcementBanner: '',
  aiAnalysisEnabled: true,
  aiRedesignEnabled: true,
  aiCoachEnabled: true,
  aiShoppingEnabled: true,
  aiLayoutEnabled: true,
  activeTextModel: 'gemini-4-hydrogen',
  activeImageModel: 'gemini-3.1-flash-lite-image',
  maxUploadMb: 10,
  updatedAt: 0,
};

export const ADMIN_OPERATOR_EMAIL = 'abc085876@gmail.com';

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}
