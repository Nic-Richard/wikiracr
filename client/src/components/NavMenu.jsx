import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, useAuth, useClerk } from '@clerk/clerk-react';
import styles from './NavMenu.module.css';

export default function NavMenu({ isPro }) {
  const [open, setOpen] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const { getToken } = useAuth();
  const { signOut }  = useClerk();
  const navigate      = useNavigate();
  const boxRef         = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function manageSubscription() {
    setLoadingPortal(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <div className={styles.wrap} ref={boxRef}>
      <button className={styles.burger} onClick={() => setOpen(o => !o)} aria-label="Menu">
        <span /><span /><span />
      </button>

      {open && (
        <div className={styles.menu}>
          <Link to="/profile" className={styles.item} onClick={() => setOpen(false)}>Profile</Link>
          <Link to="/account" className={styles.item} onClick={() => setOpen(false)}>Account</Link>
          <Link to="/leaderboard" className={styles.item} onClick={() => setOpen(false)}>Leaderboard</Link>
          <SignedIn>
            {isPro
              ? <button className={styles.item} onClick={manageSubscription} disabled={loadingPortal}>
                  {loadingPortal ? 'Loading...' : 'Manage Subscription'}
                </button>
              : <Link to="/upgrade" className={styles.item} onClick={() => setOpen(false)}>Upgrade to Pro</Link>
            }
            <div className={styles.rule} />
            <button className={styles.item} onClick={() => { setOpen(false); signOut(() => navigate('/')); }}>Sign Out</button>
          </SignedIn>
          <SignedOut>
            <div className={styles.rule} />
            <SignInButton mode="modal" afterSignInUrl="/menu">
              <button className={styles.item} onClick={() => setOpen(false)}>Sign In</button>
            </SignInButton>
          </SignedOut>
        </div>
      )}
    </div>
  );
}
