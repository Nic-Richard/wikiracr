import { useState, useRef, useEffect, useMemo } from 'react';
import { useUser, SignInButton } from '../lib/auth';
import styles from './ChatPanel.module.css';

const CHAT_RULES_VERSION = '2026-10-20';

export default function ChatPanel({ messages, mySocketId, onSend, onReport }) {
  const { user } = useUser();
  if (!user) return <SignedOutChat />;
  const storageKey = `wikiracrBlockedChat:${user.id}`;
  return <Chat key={storageKey} viewerId={user.id} {...{ messages, mySocketId, onSend, onReport, storageKey }} />;
}

function SignedOutChat() {
  const [open, setOpen] = useState(false);
  if (!open) return <button className={styles.launcher} onClick={() => setOpen(true)}>Chat</button>;
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Chat</span>
        <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">&times;</button>
      </div>
      <div className={styles.list}>
        <div className={styles.reportForm}>
          <strong>Sign in to chat</strong>
          <p>Chat is for signed-in players. You can keep racing as a guest.</p>
          <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
            <button className={styles.action} type="button">Sign in</button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
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
  const [rulesAccepted, setRulesAccepted] = useState(() => {
    try { return localStorage.getItem(`${storageKey}:rules`) === CHAT_RULES_VERSION; }
    catch { return false; }
  });
  const [agree, setAgree] = useState(false);
  const identity = message => `account:${message.userId}`;
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
    if (!text || !rulesAccepted) return;
    setDraft('');
    setNotice('');
    onSend(text, CHAT_RULES_VERSION).catch(error => { setDraft(text); setNotice(error.message); });
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
        {!rulesAccepted ? <form className={styles.reportForm} onSubmit={event => {
          event.preventDefault();
          if (!agree) return;
          try { localStorage.setItem(`${storageKey}:rules`, CHAT_RULES_VERSION); } catch {}
          setRulesAccepted(true);
        }}>
          <strong>Before using chat</strong>
          <p>Other players can read what you send. Keep your real name, contact details, passwords and location private. Do not post harassment, threats, hate, sexual content or spam.</p>
          <p>Use Block to hide a player's messages and Report to ask WikiRacr to review abuse. You can turn chat off in Settings.</p>
          <label><input type="checkbox" checked={agree} onChange={event => setAgree(event.target.checked)} /> I agree to the <a href="https://wikiracr.com/terms" target="_blank" rel="noopener noreferrer">Terms</a> and have read the <a href="https://wikiracr.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</label>
          <button className={styles.action} type="submit" disabled={!agree}>Enable chat</button>
        </form> : <>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {managing ? <>
          <p className={styles.notice}>Blocked players' messages are hidden on this device.</p>
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
          <p>The message, player details and reason will be saved by WikiRacr and sent to its private staff channel on Discord for review.</p>
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
        </>}
      </div>
      {rulesAccepted && <form className={styles.inputRow} onSubmit={submit}>
        <input
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Message..."
          maxLength={200}
        />
        <button className={styles.sendBtn} type="submit" disabled={!draft.trim()}>Send</button>
      </form>}
    </div>
  );
}
