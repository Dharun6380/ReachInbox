import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Dashboard } from './components/Dashboard';
import { ShieldCheck, Flame, Cpu } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSuccess = async (credential: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const handleDevLogin = (devEmail: string) => {
    handleLoginSuccess(`mock_token_${devEmail}`);
  };

  if (!token || !user) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="min-h-screen flex items-center justify-center bg-obsidian-950 relative overflow-hidden px-4">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-brand-600/20 blur-[150px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

          <div className="w-full max-w-md glass-premium p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/25 mb-5 hover:scale-105 transition-transform duration-300">
                <Flame className="w-8 h-8 text-white animate-pulse" />
              </div>
              
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                Reach<span className="text-brand-400">Inbox</span>
              </h1>
              <p className="text-sm text-slate-400 max-w-xs mb-8">
                Transforming cold outreach with high-throughput persistent email scheduling.
              </p>

              {error && (
                <div className="w-full p-3 mb-6 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg text-left animate-pulse">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center py-6">
                  <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-xs text-slate-400">Syncing with Outbox Core...</p>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-4">
                  <div className="flex justify-center w-full">
                    {GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'your_google_client_id_here' ? (
                      <GoogleLogin
                        onSuccess={(credentialResponse) => {
                          if (credentialResponse.credential) {
                            handleLoginSuccess(credentialResponse.credential);
                          }
                        }}
                        onError={() => setError('Google Sign-In failed')}
                        theme="filled_black"
                        shape="pill"
                        text="signin_with"
                      />
                    ) : (
                      <div className="text-center w-full">
                        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mb-4">
                          Google Client ID is not configured in .env. Click the Developer login below to test immediately!
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs text-slate-500 uppercase">
                      <span className="bg-obsidian-900 px-3">Or quick developer login</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDevLogin('mitrajit@reachinbox.ai')}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 hover:border-brand-500/30"
                  >
                    <Cpu className="w-4 h-4 text-brand-400" />
                    Developer Sign-In (Bypass Auth)
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800/60 flex justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                Persistent Database
              </span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  return (
    <Dashboard 
      user={user} 
      token={token} 
      onLogout={handleLogout} 
    />
  );
}
