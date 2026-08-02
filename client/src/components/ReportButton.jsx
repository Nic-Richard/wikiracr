import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import styles from './ReportButton.module.css';

export default function ReportButton({ context = {}, openUp = false }) {
  const { getToken, isSignedIn } = useAuth();
  const [open, setOpen]     = useState(false);
  const [type, setType]     = useState(context.pairId ? 'pair' : 'bug');
  const [message, setMessage] = useState('');
  const [state, setState]   = useState('idle');
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggle() {
    setOpen(o => !o);
    setState('idle');
  }

  async function submit() {
    if (!message.trim()) return;
    setState('sending');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (isSignedIn) {
        const token = await getToken();
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/report', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, message, context }),
      });
      if (!res.ok) throw new Error('failed');
      setState('sent');
      setMessage('');
      setTimeout(() => setOpen(false), 1400);
    } catch {
      setState('error');
    }
  }

  return (
    <div className={styles.wrap} ref={boxRef}>
      <button
        className={styles.toggle}
        onClick={toggle}
        title="Report a problem"
        aria-label="Report a problem"
      >
        <span className={styles.badge}>!</span>
      </button>

      {open && (
        <div className={`${styles.panel} ${openUp ? styles.panelUp : ''}`}>
          {state === 'sent' ? (
            <p className={styles.thanks}>Thanks, got it.</p>
          ) : (
            <>
              <p className={styles.label}>REPORT A PROBLEM</p>
              <div className={styles.typeRow}>
                {context.pairId && (
                  <button className={`${styles.typeBtn} ${type === 'pair' ? styles.typeBtnSel : ''}`} onClick={() => setType('pair')}>Bad pair</button>
                )}
                <button className={`${styles.typeBtn} ${type === 'bug' ? styles.typeBtnSel : ''}`} onClick={() => setType('bug')}>Bug</button>
                <button className={`${styles.typeBtn} ${type === 'other' ? styles.typeBtnSel : ''}`} onClick={() => setType('other')}>Other</button>
              </div>
              <textarea
                className={styles.textarea}
                placeholder={type === 'pair' ? "What's wrong with this pair? (required)" : 'What happened? (required)'}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={2000}
                rows={3}
              />
              {state === 'error' && <p className={styles.error}>Could not send. Try again?</p>}
              <button className={styles.submit} onClick={submit} disabled={state === 'sending' || !message.trim()}>
                {state === 'sending' ? 'SENDING...' : 'SEND REPORT'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
