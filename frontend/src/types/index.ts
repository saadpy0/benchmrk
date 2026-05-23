export interface User {
    id: string;
    email: string;
    role: 'CREATOR' | 'BRAND' | 'ADMIN';
  }
  
  export interface CreatorProfile {
    id: string;
    displayName: string;
    bio?: string;
    kycStatus: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    reputationScore: number;
  }
  
  export interface BrandProfile {
    id: string;
    companyName: string;
    gstNumber?: string;
    verified: boolean;
  }
  
  export interface Campaign {
    id: string;
    title: string;
    description: string;
    guidelines: string;
    cpvRate: string;
    totalBudget: string;
    status: string;
    startDate: string;
    endDate: string;
    brand: { companyName: string };
  }
  
  export interface Application {
    id: string;
    campaignId: string;
    status: string;
    createdAt: string;
    campaign: { title: string; status: string; cpvRate: string };
  }
  
  export interface Submission {
    id: string;
    campaignId: string;
    platform: 'INSTAGRAM' | 'YOUTUBE';
    contentUrl: string;
    status: string;
    verifiedViews?: number;
    createdAt: string;
    campaign: { title: string; cpvRate: string };
  }
  
  export interface Wallet {
    balance: string | number;
    totalEarned: string | number;
  }