'use client';

import { SWRConfig } from 'swr';

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        dedupingInterval: 2000,
        onError: (err: { status?: number }) => {
          if (err?.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth:logout'));
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
