import { AppTabs } from '@/components/app-tabs';
import { useRankingSync } from '@/hooks/use-ranking-sync';

export default function TabLayout() {
  useRankingSync();
  return <AppTabs />;
}
