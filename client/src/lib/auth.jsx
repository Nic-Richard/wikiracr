import { Children, cloneElement, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as WebAuth from '@clerk/clerk-react';
import { NATIVE_APP, NativeAuth } from './platform';

const AuthContext = createContext(null);

function NativeProvider({ publishableKey, children }) {
  const [state, setState] = useState({ isLoaded: false, user: null, error: null });
  const apply = useCallback(result => setState({ isLoaded: true, user: result.user || null, error: null }), []);
  const refresh = useCallback(async () => {
    const result = await NativeAuth.initialize({ publishableKey });
    apply(result);
    return result;
  }, [apply, publishableKey]);

  useEffect(() => {
    let stopped = false;
    let listener;
    NativeAuth.addListener('authChanged', apply).then(handle => { if (stopped) handle.remove(); else listener = handle; });
    refresh().catch(() => { if (!stopped) setState({ isLoaded: true, user: null, error: 'Sign-in is unavailable. You can still play as a guest.' }); });
    return () => { stopped = true; listener?.remove(); };
  }, [apply, refresh]);

  const openSignIn = useCallback(async () => {
    try {
      await NativeAuth.initialize({ publishableKey });
      const result = await NativeAuth.signIn();
      apply(result);
    } catch (error) {
      if (error.code !== 'AUTH_CANCELLED') setState(previous => ({ ...previous, error: error.message || 'Could not sign in. Please try again.' }));
    }
  }, [apply, publishableKey]);
  const signOut = useCallback(async callback => {
    try {
      await NativeAuth.signOut();
      apply({ user: null });
      if (typeof callback === 'function') callback();
    } catch { setState(previous => ({ ...previous, error: 'Could not sign out. Please try again.' })); }
  }, [apply]);
  const getToken = useCallback(async () => (await NativeAuth.getToken()).token || null, []);
  const value = useMemo(() => ({ ...state, isSignedIn: !!state.user, getToken, openSignIn, signOut, refresh }), [state, getToken, openSignIn, signOut, refresh]);

  return <AuthContext.Provider value={value}>
    {state.error && <div className="native-auth-error" role="alert">{state.error}<button onClick={() => setState(previous => ({ ...previous, error: null }))} aria-label="Dismiss">×</button></div>}
    {children}
  </AuthContext.Provider>;
}

export function AuthProvider(props) {
  return NATIVE_APP ? <NativeProvider {...props} /> : <WebAuth.ClerkProvider {...props} />;
}
const useNativeAuth = () => useContext(AuthContext);
export const useUser = NATIVE_APP ? useNativeAuth : WebAuth.useUser;
export const useAuth = NATIVE_APP ? useNativeAuth : WebAuth.useAuth;
export const useClerk = NATIVE_APP ? useNativeAuth : WebAuth.useClerk;
export function SignedIn({ children }) { return NATIVE_APP ? (useNativeAuth().isSignedIn ? children : null) : <WebAuth.SignedIn>{children}</WebAuth.SignedIn>; }
export function SignedOut({ children }) { return NATIVE_APP ? (!useNativeAuth().isSignedIn ? children : null) : <WebAuth.SignedOut>{children}</WebAuth.SignedOut>; }
function NativeSignInButton({ children }) {
  const { openSignIn } = useNativeAuth();
  const child = Children.only(children);
  return cloneElement(child, { onClick: event => { child.props.onClick?.(event); if (!event.defaultPrevented) openSignIn(); } });
}
export function SignInButton(props) { return NATIVE_APP ? <NativeSignInButton {...props} /> : <WebAuth.SignInButton {...props} />; }
