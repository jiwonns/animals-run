import { AppTabs } from '@/components/app-tabs';
import { useRankingSync } from '@/hooks/use-ranking-sync';
import { WalkProvider } from '@/providers/walk-provider';

export default function TabLayout() {
  useRankingSync();
  return (
    <WalkProvider>
      <AppTabs />
    </WalkProvider>
  );
}
