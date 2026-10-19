import { Link } from 'react-router-dom';
import { SignInButton, SignedOut } from '../lib/auth';

export default function NativePro() {
  return <main className="native-info"><Link to="/" className="wordmark"><span className="w">Wiki</span>Racr</Link><h1>Your WikiRacr account</h1><p>Solo races, multiplayer and the daily challenge are ready to play. Sign in to keep your scores and join ranked races.</p><p>Existing Pro members also have access to Speedrun, Higher or Lower and custom lobbies. Subscription changes are managed on the WikiRacr website.</p><SignedOut><SignInButton><button>Sign in</button></SignInButton></SignedOut><p><Link to="/">Back to Play →</Link></p></main>;
}
