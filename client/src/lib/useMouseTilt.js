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
    window.addEventListener('mousemove', onMouse, { passive: true });
    return () => window.removeEventListener('mousemove', onMouse);
  }, []);

  return tilt;
}
