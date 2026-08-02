import { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ messages, mySocketId, onSend }) {
  const [open, setOpen]     = useState(false);
  const [draft, setDraft]   = useState('');
  const listRef             = useRef(null);
  const unread              = useRef(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (open) {
      unread.current = 0;
      setUnreadCount(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    } else if (messages.length) {
      unread.current += 1;
      setUnreadCount(unread.current);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

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
        <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">&times;</button>
      </div>
      <div className={styles.list} ref={listRef}>
        {messages.length === 0 && <p className={styles.empty}>No messages yet</p>}
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${m.socketId === mySocketId ? styles.mine : ''}`}>
            <span className={styles.msgName}>{m.username}</span>
            <span className={styles.msgText}>{m.text}</span>
          </div>
        ))}
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
