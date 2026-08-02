import { useUser } from '@clerk/clerk-react';

export function useIsPro() {
  const { user } = useUser();
  return user?.publicMetadata?.isPro || false;
}
