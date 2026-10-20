import { useState, useRef, useEffect, useMemo } from 'react';
import { useUser } from '../lib/auth';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ messages, mySocketId, onSend, onReport }) {
  const { user } = useUser();
  const storageKey = `wikiracrBlockedChat:${user?.id || 'guest'}`;
  return <Chat key={storageKey} viewerId={user?.id} {...{ messages, mySocketId, onSend, onReport, storageKey }} />;
}

function Chat({ messages, mySocketId, onSend, onReport, storageKey, viewerId }) {
  const [blocked, setBlocked] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  });
  const [managing, setManaging] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState('Harassment');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const identity = message => message.userId ? `account:${message.userId}` : `guest:${message.socketId}`;
  const isMine = message => message.socketId === mySocketId || (viewerId && message.userId === viewerId);
  const visible = useMemo(() => messages.filter(message => !blocked[identity(message)]), [messages, blocked]);
  const [open, setOpen]     = useState(false);
  const [draft, setDraft]   = useState('');
  const listRef             = useRef(null);
  const unread              = useRef(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessage = useRef(null);

  function updateBlocked(next) {
    setBlocked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setNotice('');
    } catch { setNotice('Blocking works for this chat, but could not be saved on this device.'); }
  }

  async function report(event) {
    event.preventDefault();
    setSending(true);
    setNotice('');
    try {
      await onReport(reporting.id, reason);
      setReporting(null);
      setNotice('Report sent for review. You can also block this player.');
    } catch (error) { setNotice(error.message); }
    finally { setSending(false); }
  }

  useEffect(() => {
    if (open) {
      unread.current = 0;
      setUnreadCount(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    } else if (visible.length && lastMessage.current !== visible.at(-1)) {
      unread.current += 1;
      setUnreadCount(unread.current);
    }
    lastMessage.current = visible.at(-1);
  }, [visible, open]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visible, open]);

  function submit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  if (!open) {
    return (
      <button className={styles.launcher} onClick={() => setOpen(true)}>
        Chat
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Chat</span>
        <button className={styles.action} onClick={() => { setManaging(!managing); setReporting(null); }}>Blocked ({Object.keys(blocked).length})</button>
        <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">&times;</button>
      </div>
      <div className={styles.list} ref={listRef}>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {managing ? <>
          <p className={styles.notice}>Blocked players' messages are hidden on this device. Guest blocks last until they reconnect.</p>
          {Object.entries(blocked).map(([id, name]) => <div className={styles.blockedRow} key={id}>
            <span>{name}</span>
            <button className={styles.action} onClick={() => { const next = { ...blocked }; delete next[id]; updateBlocked(next); }}>Unblock</button>
          </div>)}
        </> : reporting ? <form onSubmit={report} className={styles.reportForm}>
          <strong>Report {reporting.username}</strong>
          <blockquote>{reporting.text}</blockquote>
          <label htmlFor="chat-report-reason">Reason</label>
          <select id="chat-report-reason" value={reason} onChange={event => setReason(event.target.value)}>
            {['Harassment', 'Hate or threats', 'Sexual content', 'Spam', 'Other'].map(value => <option key={value}>{value}</option>)}
          </select>
          <p>The message and player details will be sent to WikiRacr for review.</p>
          <div className={styles.actions}>
            <button className={styles.action} type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send report'}</button>
            <button className={styles.action} type="button" disabled={sending} onClick={() => setReporting(null)}>Cancel</button>
          </div>
        </form> : <>
        {visible.length === 0 && <p className={styles.empty}>No messages to show</p>}
        {visible.map((m, i) => (
          <div key={m.id || i} className={`${styles.msg} ${isMine(m) ? styles.mine : ''}`}>
            <span className={styles.msgName}>{m.username}</span>
            <span className={styles.msgText}>{m.text}</span>
            {!isMine(m) && <div className={styles.actions}>
              <button className={styles.action} onClick={() => updateBlocked({ ...blocked, [identity(m)]: m.username })}>Block</button>
              {m.id && onReport && <button className={styles.action} onClick={() => { setReporting(m); setReason('Harassment'); setNotice(''); }}>Report</button>}
            </div>}
          </div>
        ))}
        </>}
      </div>
      <form className={styles.inputRow} onSubmit={submit}>
        <input
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Message..."
          maxLength={200}
        />
        <button className={styles.sendBtn} type="submit" disabled={!draft.trim()}>Send</button>
      </form>
    </div>
  );
}
