import { useEffect, useState } from 'react';

// Matches the phone breakpoint in Game.module.css.
const QUERY = '(max-width: 760px), (pointer: coarse) and (max-width: 940px)';

function matches() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

export default function useCompactLayout() {
  const [compact, setCompact] = useState(matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const list = window.matchMedia(QUERY);
    const onChange = () => setCompact(list.matches);
    list.addEventListener('change', onChange);
    onChange();
    return () => list.removeEventListener('change', onChange);
  }, []);
  return compact;
}
