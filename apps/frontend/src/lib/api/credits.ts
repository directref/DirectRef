import { api } from './client';
import type { CreditBalance, CreditPackage } from '../types';

export const creditsApi = {
  getBalance: () =>
    api.get<{ data: CreditBalance }>('/api/credits/balance'),

  getPackages: () =>
    api.get<{ data: CreditPackage[] }>('/api/credits/packages'),

  purchase: (packageId: string) =>
    api.post<{ data: CreditBalance }>('/api/credits/purchase', { packageId }),
};
