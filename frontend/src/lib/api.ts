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

// wallet
export const getWalletBalance = () => api.get('/payouts/balance');
export const requestPayout = (amount: number, upiId: string) =>
  api.post('/payouts/request', { amount, upiId });

// analytics
export const getCreatorAnalytics = () => api.get('/analytics/creator');
export const getBrandAnalytics = () => api.get('/analytics/brand');

export default api;