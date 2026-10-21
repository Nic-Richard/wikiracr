import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import styles from './LegalPage.module.css';

const SUPPORT_EMAIL = 'support@wikiracr.com';

export default function Terms() {
  const { enabled: motion } = useMotion();

  return (
    <div className={styles.root} data-route-scroll>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <nav className={styles.headerLinks} aria-label="Legal navigation">
            <Link to="/privacy" className={styles.topLink}>Privacy</Link>
            <Link to="/account" className={styles.topLink}>Account</Link>
            <Link to="/menu" className={styles.topLink}>Play</Link>
          </nav>
        </header>

        <main>
          <section className={styles.hero}>
            <p className={styles.kicker}>TERMS OF SERVICE</p>
            <h1>Terms of Service</h1>
            <p className={styles.updated}>Last updated: October 20, 2026</p>
          </section>


          <div className={styles.content}>
            <section className={styles.section}>
              <h2>1. Acceptance of these terms</h2>
              <p>
                By visiting WikiRacr, creating an account, joining a room, playing a game, or buying a Pro subscription, you agree to these terms. If you do not agree, do not use WikiRacr.
              </p>
            </section>

            <section className={styles.section}>
              <h2>2. What WikiRacr is</h2>
              <p>
                WikiRacr is a competitive Wikipedia navigation game. Players start on one Wikipedia article and try to reach a goal article by clicking Wikipedia links only. WikiRacr includes solo play, multiplayer rooms, leaderboards, ranked play, Daily Challenge, Speedrun, Knockout, Clicks mode, Score mode, and Higher or Lower.
              </p>
              <p>
                WikiRacr is an independent project operated by Nic Richard in New Brunswick, Canada. It is not owned by, operated by, or endorsed by Wikipedia or the Wikimedia Foundation.
              </p>
            </section>

            <section className={styles.section}>
              <h2>3. Accounts and guest play</h2>
              <p>
                Some parts of WikiRacr can be played as a guest. Other features require a signed-in account, including saved history, Daily Challenge progress, ranked play, leaderboards, chat, and Custom Lobby access.
              </p>
              <p>
                You must be at least 13 years old to create an account. You are responsible for keeping your account secure and for activity that happens through your account. Login and account management are handled through Clerk.
              </p>
              <p>
                You can permanently delete your account from <Link to="/account">Account</Link>. Deletion closes access, cancels active WikiRacr subscriptions and removes account-linked game data and bot alerts, with retries if a provider is unavailable. See the <Link to="/privacy#delete-account">privacy policy</Link> for retained records. Cancelling a subscription alone keeps your account. Deletion does not automatically refund past payments or limit refund rights provided by law; contact support for a refund request.
              </p>
            </section>

            <section className={styles.section}>
              <h2>4. Subscriptions and Pro features</h2>
              <p>
                WikiRacr Pro unlocks additional features such as creating Custom Lobbies, Speedrun mode, and Higher or Lower. The exact Pro features may change as WikiRacr develops.
              </p>
              <p>
                Pro is a paid subscription. Web subscriptions are billed through Stripe. Android subscriptions purchased in the app are billed through Google Play, renew automatically at the price shown before confirmation, and can be cancelled in Google Play. Prices may differ by platform, currency and region. WikiRacr does not store your full card details.
              </p>
              <p>
                Manage cancellations and refund requests through the provider used for the purchase, or contact support. Cancellation normally stops the next renewal and keeps access until the paid period ends; refunds, payment failures or account deletion may end access earlier. Deleting your WikiRacr account cancels linked subscriptions and does not automatically refund earlier payments. Your rights under applicable law are unaffected.
              </p>
            </section>

            <section className={styles.section}>
              <h2>5. Fair play</h2>
              <p>
                WikiRacr is meant to be played fairly. Do not cheat, automate gameplay, exploit bugs, interfere with other players, manipulate scores, overload the service, bypass account or Pro restrictions, or use multiple accounts to gain an unfair advantage.
              </p>
              <p>
                WikiRacr may remove scores, restrict features, suspend access, or take other reasonable action when cheating, abuse, or suspicious activity is detected.
              </p>
            </section>

            <section className={styles.section}>
              <h2>6. Multiplayer chat and player behavior</h2>
              <p>Before sending chat messages, you must explicitly accept the chat rules and these terms. The chat panel reminds you to protect your personal information and explains how to block and report abuse.</p>
              <p>Chat is available to signed-in players. Use Block beside a chat message to hide that player's messages on this device. Manage blocked players from the chat panel; blocks do not prevent matchmaking. Use Report beside a message to send the message, player details and your selected reason to WikiRacr for review.</p>
              <p>
                Multiplayer chat is for game-related conversation and light banter, not harassment. Do not post threats, hateful content, sexual content, spam, private information, impersonation, or anything illegal.
              </p>
              <p>
                Chat messages may be visible to other players in the same room. Do not share personal information in chat unless you are comfortable with other players seeing it.
              </p>
            </section>

            <section className={styles.section}>
              <h2>7. Reports and moderation</h2>
              <p>
                WikiRacr includes reporting tools for bugs, bad article pairs, player behavior, and other issues. Reports may include the message you submit, game context, room or pair context, and account information when you are signed in.
              </p>
              <p>Use Report article to flag Wikipedia content for moderator review. WikiRacr may block reviewed titles from article display, navigation and future race selection. Reporting an article does not automatically block it.</p>
              <p>
                Moderation decisions are made at WikiRacr's discretion. Reports may not always result in action, and action may be taken without a detailed explanation when needed to protect the service or other players.
              </p>
            </section>

            <section className={styles.section}>
              <h2>8. Leaderboards, ranked scores, and public results</h2>
              <p>
                WikiRacr may show usernames, scores, times, clicks, ranked ratings, streaks, and other game results on leaderboards, profiles, match screens, or room results. By submitting scores or playing public competitive modes, you understand that those results may be visible to other players.
              </p>
            </section>

            <section className={styles.section}>
              <h2>9. Acceptable use</h2>
              <p>Do not use WikiRacr to:</p>
              <ul>
                <li>break the law or encourage illegal activity;</li>
                <li>attack, scrape, reverse engineer, overload, or disrupt the service;</li>
                <li>access accounts, rooms, data, or systems you are not allowed to access;</li>
                <li>post abusive, misleading, harmful, or infringing content;</li>
                <li>resell accounts, subscriptions, or access to WikiRacr without permission.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2>10. Third-party services and content</h2>
              <p>
                WikiRacr relies on third-party services and content, including Wikipedia and Wikimedia APIs or dumps for article content and links, Clerk for authentication, Stripe for payments and billing, and hosting infrastructure for operating the website.
              </p>
              <p>
                Third-party services may have their own terms and privacy policies. WikiRacr is not responsible for third-party content, outages, policies, billing systems, or decisions outside WikiRacr's control.
              </p>
              <p>
                Some article images are loaded from Wikipedia or Wikimedia projects. Those images may have their own license and attribution requirements on the source page.
              </p>
            </section>

            <section className={styles.section}>
              <h2>11. Availability and changes to the service</h2>
              <p>
                WikiRacr may change, add, remove, pause, or discontinue features at any time. The service may be unavailable because of maintenance, bugs, hosting issues, API issues, abuse prevention, or other reasons.
              </p>
              <p>
                WikiRacr does not guarantee uptime, uninterrupted access, perfect article data, perfect scoring, or error-free gameplay.
              </p>
            </section>

            <section className={styles.section}>
              <h2>12. Limitation of liability</h2>
              <p>
                WikiRacr is provided as-is. To the fullest extent allowed by law, WikiRacr is not responsible for indirect, incidental, special, or consequential losses, lost data, lost profits, lost scores, lost rankings, service interruptions, or issues caused by third-party services.
              </p>
              <p>
                If something goes wrong, your main remedy is to stop using WikiRacr or cancel your subscription through the billing portal where available. Some laws may give you rights that cannot be limited by these terms.
              </p>
            </section>

            <section className={styles.section}>
              <h2>13. Changes to these terms</h2>
              <p>
                WikiRacr may update these terms as the game changes. The latest version will be posted on this page. Continued use of WikiRacr after changes are posted means you accept the updated terms.
              </p>
            </section>

            <section className={styles.section}>
              <h2>14. Governing law</h2>
              <p>
                These terms are governed by the laws of New Brunswick and Canada.
              </p>
            </section>

            <section className={styles.section}>
              <h2>15. Contact</h2>
              <p>
                Questions about these terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </section>
          </div>
        </main>

        <footer className={styles.footerNav}>
          <span>WikiRacr legal</span>
          <div className={styles.footerLinks}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/">Home</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
