import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import styles from './LegalPage.module.css';

const SUPPORT_EMAIL = 'support@wikiracr.com';

export default function Privacy() {
  const { enabled: motion } = useMotion();

  return (
    <div className={styles.root} data-route-scroll>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <nav className={styles.headerLinks} aria-label="Legal navigation">
            <Link to="/terms" className={styles.topLink}>Terms</Link>
            <Link to="/account" className={styles.topLink}>Account</Link>
            <Link to="/menu" className={styles.topLink}>Play</Link>
          </nav>
        </header>

        <main>
          <section className={styles.hero}>
            <p className={styles.kicker}>PRIVACY POLICY</p>
            <h1>Privacy Policy</h1>
            <p className={styles.updated}>Last updated: July 7, 2026</p>
            <p className={styles.intro}>
              This policy explains what WikiRacr collects, how it is used, what may be visible to other players, and where third-party services fit in.
            </p>
          </section>

          <div className={styles.content}>
            <section className={styles.section}>
              <h2>1. Information WikiRacr collects</h2>
              <p>WikiRacr may collect the following types of information:</p>
              <ul>
                <li>account information from Clerk, such as your user ID, username, display name, email address, profile image URL, and account timestamps;</li>
                <li>game data, such as article pairs, paths taken, clicks, time, scores, completions, Daily Challenge progress, streaks, ranked rating, wins, losses, and personal bests;</li>
                <li>leaderboard and profile data, such as username, scores, times, clicks, streaks, ranked rating, and mode-specific results;</li>
                <li>multiplayer room data, including room codes, room settings, player names, socket session activity, match state, and chat messages sent in rooms;</li>
                <li>reports submitted through the report tool, including report type, message, context, account ID when signed in, and submission time;</li>
                <li>subscription status and billing identifiers needed to connect a Clerk account to Stripe, such as Stripe customer and subscription IDs;</li>
                <li>basic technical data that may appear in server or hosting logs, such as IP address, request path, browser information, timestamps, errors, and security-related events.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2>2. Account information through Clerk</h2>
              <p>
                WikiRacr uses Clerk for sign-in, account management, sessions, and profile management. Clerk may process account details and authentication data under its own policies. WikiRacr uses Clerk account IDs to connect your account to saved game data, Pro status, reports, and profile information.
              </p>
            </section>

            <section className={styles.section}>
              <h2>3. Payments and subscriptions through Stripe</h2>
              <p>
                WikiRacr uses Stripe for checkout, subscription billing, the billing portal, and payment-related events. Stripe handles payment details such as card information. WikiRacr stores or receives only the subscription and customer identifiers needed to know whether your account has Pro access.
              </p>
              <p>
                Billing questions, cancellations, invoices, and refund workflows may be handled through Stripe or the Stripe billing portal where available.
              </p>
            </section>

            <section className={styles.section}>
              <h2>4. How information is used</h2>
              <p>WikiRacr uses information to:</p>
              <ul>
                <li>run games, multiplayer rooms, chat, scoring, matchmaking, ranked play, and leaderboards;</li>
                <li>save account-linked history, Daily Challenge progress, streaks, ratings, and personal bests;</li>
                <li>provide Pro features and confirm subscription status;</li>
                <li>respond to reports, support requests, bugs, abuse, cheating, and safety issues;</li>
                <li>maintain, debug, secure, and improve the service.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2>5. What other players can see</h2>
              <p>
                Other players may see information needed for the game, including your username, room presence, chat messages in shared rooms, scores, clicks, times, ranked rating, leaderboard entries, match results, and public profile stats.
              </p>
              <p>
                Do not put private information in your username, chat messages, or report text unless you are comfortable submitting it to WikiRacr or showing it to other players where applicable.
              </p>
            </section>

            <section className={styles.section}>
              <h2>6. Third-party providers</h2>
              <p>
                WikiRacr depends on third-party providers to operate the service. This includes Clerk for authentication, Stripe for payments and billing, Wikipedia and Wikimedia services for article content and link data, and hosting or server infrastructure for running the website and API.
              </p>
              <p>
                These providers may process information according to their own terms and privacy policies. WikiRacr does not control Wikipedia article content, Wikimedia availability, Clerk authentication systems, Stripe billing systems, or hosting provider logs.
              </p>
            </section>

            <section className={styles.section}>
              <h2>7. Cookies, sessions, and local settings</h2>
              <p>
                WikiRacr and Clerk may use cookies or similar browser storage needed for authentication, sessions, security, and basic operation. WikiRacr also stores some local preferences on your device, such as motion effects, game audio, chat visibility, and game zoom settings.
              </p>
              <p>
                This policy does not describe advertising or newsletter tracking because WikiRacr does not currently include those features. If analytics, ads, newsletters, or non-essential tracking are added later, this policy should be updated before launch of those features.
              </p>
            </section>

            <section className={styles.section}>
              <h2>8. Data retention</h2>
              <p>
                WikiRacr keeps information for as long as it is reasonably useful for operating the game, showing stats and leaderboards, supporting accounts, detecting abuse, maintaining records, or meeting legal and security needs.
              </p>
              <p>
                Some information may be kept longer than an active account, such as leaderboard entries, reports, logs, fraud or abuse records, and backup copies. Retention periods may vary by data type and may change as WikiRacr matures.
              </p>
            </section>

            <section className={styles.section}>
              <h2>9. Your choices and account deletion</h2>
              <p>
                You can manage login details and delete your Clerk account from the account profile panel where available. Deleting your account may not instantly remove every game record, leaderboard entry, report, backup, log, or billing record.
              </p>
              <p>
                For account or data requests, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. WikiRacr may need to verify your account before making changes to account-linked information.
              </p>
            </section>

            <section className={styles.section}>
              <h2>10. Children and minimum age</h2>
              <p>
                WikiRacr is not intended for young children. You should only use WikiRacr if you are old enough to understand these terms and privacy practices, or if a parent or guardian has reviewed and allowed your use.
              </p>
              <p>
                If you believe a child has provided personal information to WikiRacr in a way that should be reviewed or removed, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </section>

            <section className={styles.section}>
              <h2>11. Security</h2>
              <p>
                WikiRacr uses service providers and reasonable technical practices to operate accounts, payments, and gameplay securely. No online service can guarantee perfect security. Use a secure login method and do not share your account access.
              </p>
            </section>

            <section className={styles.section}>
              <h2>12. Changes to this policy</h2>
              <p>
                WikiRacr may update this policy as the product, providers, or data practices change. The latest version will be posted on this page.
              </p>
            </section>

            <section className={styles.section}>
              <h2>13. Contact</h2>
              <p>
                Questions or requests about privacy can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </section>
          </div>
        </main>

        <footer className={styles.footerNav}>
          <span>WikiRacr privacy</span>
          <div className={styles.footerLinks}>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/">Home</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
