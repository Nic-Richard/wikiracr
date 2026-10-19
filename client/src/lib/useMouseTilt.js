import { useEffect, useState } from 'react';

export function useMouseTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMouse = (e) => {
      setTilt({
        x: (e.clientX / window.innerWidth  - 0.5) * 5,
        y: (e.clientY / window.innerHeight - 0.5) * -5,
      });
    };
    window.addEventListener('pointermove', onMouse, { passive: true });
    const onTilt = ({ detail }) => setTilt({ x: detail.x * 5, y: detail.y * -5 });
    window.addEventListener('wikiracr-tilt', onTilt);
    return () => { window.removeEventListener('pointermove', onMouse); window.removeEventListener('wikiracr-tilt', onTilt); };
  }, []);

  return tilt;
}
