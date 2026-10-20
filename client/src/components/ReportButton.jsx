import { appFetch } from '../lib/platform';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NATIVE_APP } from '../lib/platform';
import { useAuth } from '../lib/auth';
import styles from './ReportButton.module.css';

export default function ReportButton({ context = {}, openUp = false, label }) {
  const { getToken, isSignedIn } = useAuth();
  const [open, setOpen]     = useState(false);
  const [type, setType]     = useState(context.articleTitle ? 'article' : context.pairId ? 'pair' : 'bug');
  const [message, setMessage] = useState('');
  const [state, setState]   = useState('idle');
  const boxRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (NATIVE_APP) {
      dialogRef.current?.showModal();
      const back = () => setOpen(false);
      window.addEventListener('native-report-back', back);
      return () => window.removeEventListener('native-report-back', back);
    }
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
      const res = await appFetch('/api/report', {
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

  const panel = (
        <div className={`${styles.panel} ${NATIVE_APP ? styles.nativePanel : openUp ? styles.panelUp : ''}`}>
          {state === 'sent' ? (
            <p className={styles.thanks}>Thanks, got it.</p>
          ) : (
            <>
              <div className={styles.heading}><p className={styles.label}>REPORT A PROBLEM</p>{NATIVE_APP && <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close report">&#215;</button>}</div>
              <div className={styles.typeRow}>
                {context.articleTitle && <button className={`${styles.typeBtn} ${type === 'article' ? styles.typeBtnSel : ''}`} onClick={() => setType('article')}>Article</button>}
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
                aria-label="Describe the problem"
              />
              <p className={styles.disclosure}>Your report and game context are saved by WikiRacr and sent to its private staff channel on Discord. Avoid including passwords or other sensitive information.</p>
              {state === 'error' && <p className={styles.error}>Could not send. Try again?</p>}
              <button className={styles.submit} onClick={submit} disabled={state === 'sending' || !message.trim()}>
                {state === 'sending' ? 'SENDING...' : 'SEND REPORT'}
              </button>
            </>
          )}
        </div>
  );
  return (
    <div className={styles.wrap} ref={boxRef}>
      <button className={label ? styles.labelToggle : styles.toggle} onClick={toggle} title={label || 'Report a problem'} aria-label={label || 'Report a problem'} aria-expanded={open}>
        {label || <span className={styles.badge}>!</span>}
      </button>
      {open && (NATIVE_APP ? createPortal(<dialog ref={dialogRef} className={styles.nativeDialog} data-native-report aria-label="Report a problem" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>{panel}</dialog>, document.body) : panel)}
    </div>
  );
}
