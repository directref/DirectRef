import useSWR, { mutate as globalMutate } from 'swr';
import { creditsApi } from '../api/credits';

const CREDITS_KEY = 'credits/balance';

export function useCreditBalance() {
  const { data, error, isLoading, mutate } = useSWR(
    CREDITS_KEY,
    () => creditsApi.getBalance().then((r) => r.data),
  );
  return { balance: data ?? null, error, isLoading, mutate };
}

/** Call after spending or purchasing a credit so every surface (sidebar,
 *  settings, wherever else) picks up the new balance immediately. */
export function refreshCreditBalance() {
  return globalMutate(CREDITS_KEY);
}
