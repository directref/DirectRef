import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { SWRProvider } from '@/components/SWRProvider';
import { TooltipProvider } from '@/components/ui/Tooltip';

export const metadata: Metadata = {
  metadataBase: new URL('https://direct-ref.com'),
  title: 'DirectRef — Find your next job',
  description: 'Skip the black hole. Connect with friends at top companies, find open roles, and send your CV directly — no cold applications.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SWRProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </SWRProvider>
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: 'var(--color-card)',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text-primary)',
            },
          }}
        />
      </body>
    </html>
  );
}
