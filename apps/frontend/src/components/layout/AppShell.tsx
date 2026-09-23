import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ProductTour } from '@/components/tour/ProductTour';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ProductTour />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
