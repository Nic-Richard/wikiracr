import { useEffect, useState } from 'react';
import { NATIVE_APP } from './platform';

export function useMouseTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (NATIVE_APP) return;
    const onMouse = (e) => {
      if (e.pointerType !== 'mouse') return;
      setTilt({
        x: (e.clientX / window.innerWidth  - 0.5) * 5,
        y: (e.clientY / window.innerHeight - 0.5) * -5,
      });
    };
    window.addEventListener('pointermove', onMouse, { passive: true });
    return () => window.removeEventListener('pointermove', onMouse);
  }, []);

  return tilt;
}
