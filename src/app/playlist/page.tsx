import { getPlaylistSections } from '@/lib/playlist';
import PlaylistClient from '@/components/PlaylistClient';

export const metadata = {
  title: 'Pre-show playlist — What\'s Going On',
  description: 'Listen to the artists playing live in Brooklyn this week.',
};

export default function PlaylistPage() {
  const daysAhead = 14;
  const sections = getPlaylistSections(daysAhead);
  const todayYmd = new Date().toISOString().split('T')[0];

  return (
    <PlaylistClient
      sections={sections}
      todayYmd={todayYmd}
      daysAhead={daysAhead}
    />
  );
}
