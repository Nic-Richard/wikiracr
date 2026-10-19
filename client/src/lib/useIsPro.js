import { useUser } from './auth';

export function useIsPro() {
  const { user } = useUser();
  return user?.publicMetadata?.isPro || false;
}
