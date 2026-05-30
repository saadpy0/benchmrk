import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// automatically attach token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// auth
export const signup = (email: string, password: string, role: 'CREATOR' | 'BRAND') =>
  api.post('/auth/signup', { email, password, role });

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const googleLogin = (accessToken: string, role: 'CREATOR' | 'BRAND') =>
  api.post('/auth/google', { accessToken, role });

// campaigns
export const getDiscoverCampaigns = () => api.get('/discover');
export const getCampaigns = (status?: string) => api.get('/campaigns', { params: { status } });
export const getCampaign = (id: string) => api.get(`/campaigns/${id}`);
export const createCampaign = (data: any) => api.post('/campaigns', data);

// creator profile
export const getCreatorProfile = () => api.get('/creators/profile');
export const createCreatorProfile = (data: any) => api.post('/creators/profile', data);

// brand profile
export const getBrandProfile = () => api.get('/brands/profile');
export const createBrandProfile = (data: any) => api.post('/brands/profile', data);

// applications
export const applyToCampaign = (id: string) => api.post(`/campaigns/${id}/apply`);
export const getMyApplications = () => api.get('/my/applications');

// submissions
export const submitContent = (id: string, data: any) => api.post(`/campaigns/${id}/submit`, data);
export const getMySubmissions = () => api.get('/my/submissions');

// creator portal (full dashboard + campaign submit)
export const getCreatorPortalDashboard = () => api.get('/creator/app/dashboard');
export const getCreatorPortalCampaigns = () => api.get('/creator/app/campaigns');
export const submitToCreatorPortalCampaign = (data: { campaignId: string; platform: 'YOUTUBE' | 'INSTAGRAM'; contentUrl: string }) =>
  api.post('/creator/app/submissions', data);
export const runCreatorPortalTracking = () => api.post('/creator/app/tracking/run-due', {});

// wallet
export const getWalletBalance = () => api.get('/payouts/balance');
export const requestPayout = (amount: number, upiId: string) =>
  api.post('/payouts/request', { amount, upiId });

// analytics
export const getCreatorAnalytics = () => api.get('/analytics/creator');
export const getBrandAnalytics = () => api.get('/analytics/brand');

// social OAuth
export const getInstagramOAuthUrl = () => api.get('/auth/instagram/start');
export const getYouTubeOAuthUrl = () => api.get('/auth/youtube/start');

// connected accounts
export const getConnectedAccounts = () => api.get('/creators/connected-accounts');
export const disconnectAccount = (accountId: string) => api.delete(`/creators/connected-accounts/${accountId}`);
export const rebuildAccountTrustScore = (accountId: string) => api.post(`/creators/connected-accounts/${accountId}/rebuild`, {});

// baselines
export const getCreatorBaseline = (platform: 'INSTAGRAM' | 'YOUTUBE') =>
  api.get('/creators/baseline', { params: { platform } });
export const rebuildInstagramConnectedBaseline = () =>
  api.post('/creators/baseline/rebuild/instagram-connected', {});
export const rebuildYouTubeConnectedBaseline = () =>
  api.post('/creators/baseline/rebuild/youtube-connected', {});
export const rebuildYouTubeLiveBaseline = (channelInput: string) =>
  api.post('/creators/baseline/rebuild/youtube-live', { channelInput });

// admin
export const getAdminStats = () => api.get('/admin/stats');
export const getAdminBrands = () => api.get('/admin/brands');
export const createAdminCampaign = (data: any) => api.post('/admin/campaigns', data);
export const getAdminUsers = () => api.get('/admin/users');
export const suspendUser = (id: string) => api.delete(`/admin/users/${id}`);
export const getPendingCampaigns = () => api.get('/admin/campaigns/pending');
export const approveCampaign = (id: string) => api.patch(`/admin/campaigns/${id}/approve`);
export const rejectCampaign = (id: string) => api.patch(`/admin/campaigns/${id}/reject`);
export const getReviewQueue = (params?: { campaignId?: string; status?: string }) =>
  api.get('/admin/review-batches', { params });
export const getReviewBatchDetails = (id: string) => api.get(`/admin/review-batches/${id}`);
export const updateReviewBatch = (id: string, data: { action: string; note?: string; amount?: number }) =>
  api.patch(`/admin/review-batches/${id}`, data);
export const runReviewSweep = (campaignId?: string) =>
  api.post('/admin/review-batches/sweep', campaignId ? { campaignId } : {});

export default api;