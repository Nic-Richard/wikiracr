import { useState, useEffect, useRef } from 'react';
import styles from './HintButton.module.css';

const cache = new Map();

export default function HintButton({ title }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [extract, setExtract] = useState(null);
  const [error, setError]     = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    setExtract(null);
    setError(null);
  }, [title]);

  useEffect(() => {
    if (!open || extract || loading) return;
    if (cache.has(title)) { setExtract(cache.get(title)); return; }

    setLoading(true);
    setError(null);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(data => {
        const text = data.extract || 'No summary available for this article.';
        cache.set(title, text);
        setExtract(text);
      })
      .catch(() => setError('Could not load a hint for this one.'))
      .finally(() => setLoading(false));
  }, [open, title, extract, loading]);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className={styles.wrap} ref={boxRef}>
      <button
        className={`${styles.bulb} ${open ? styles.bulbOn : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Hint: what is the destination article about?"
        aria-label="Show a hint about the destination"
      >
        &#128161;
      </button>
      {open && (
        <div className={styles.popover}>
          <p className={styles.popoverLabel}>ABOUT THE DESTINATION</p>
          {loading && <p className={styles.popoverText}>Loading...</p>}
          {error && <p className={styles.popoverText}>{error}</p>}
          {extract && <p className={styles.popoverText}>{extract}</p>}
        </div>
      )}
    </div>
  );
}
