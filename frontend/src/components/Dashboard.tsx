import { useState, useEffect } from 'react';
import type { UserProfile } from '../App';
import { ComposeModal } from './ComposeModal';
import { 
  Plus, LogOut, Mail, Send, AlertCircle, Clock, 
  Search, Layers, ExternalLink, Calendar, Flame
} from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
  token: string;
  onLogout: () => void;
}

export interface EmailJob {
  id: string;
  email: string;
  subject: string;
  scheduledAt: string;
  sentAt: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error: string | null;
}

interface Stats {
  campaigns: number;
  pending: number;
  sent: number;
  failed: number;
}

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

export function Dashboard({ user, token, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<Stats>({ campaigns: 0, pending: 0, sent: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const fetchData = async () => {
    try {
      const statsRes = await fetch(`${API_URL}/campaigns/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const statusParam = activeTab === 'scheduled' ? 'PENDING' : 'SENT_OR_FAILED';
      const jobsRes = await fetch(`${API_URL}/campaigns/jobs?status=${statusParam}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [activeTab, token]);

  const filteredJobs = jobs.filter(job => 
    job.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPreviewUrl = (errorStr: string | null): string | null => {
    if (!errorStr) return null;
    const match = errorStr.match(/Preview URL:\s*(https?:\/\/[^\s]+)/i);
    return match ? match[1] : null;
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col">
      <div className="absolute top-0 right-0 w-[50%] h-[30%] rounded-full bg-brand-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[30%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <header className="sticky top-0 z-40 bg-obsidian-900/60 backdrop-blur-md border-b border-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Flame className="w-5.5 h-5.5 text-white animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Reach<span className="text-brand-400">Inbox</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
            {user.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-9 h-9 rounded-full ring-2 ring-brand-500/30 object-cover" 
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-white leading-tight">{user.name}</p>
              <p className="text-xs text-slate-400 leading-tight">{user.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6 relative z-10">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700/60 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Campaigns</span>
              <Layers className="w-4.5 h-4.5 text-brand-400" />
            </div>
            <p className="text-2xl font-bold text-white">{stats.campaigns}</p>
          </div>

          <div className="glass p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700/60 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Scheduled</span>
              <Clock className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
          </div>

          <div className="glass p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700/60 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sent</span>
              <Send className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats.sent}</p>
          </div>

          <div className="glass p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700/60 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Failed</span>
              <AlertCircle className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-rose-400">{stats.failed}</p>
          </div>
        </section>

        <section className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 self-start">
            <button
              onClick={() => { setActiveTab('scheduled'); setLoading(true); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'scheduled' 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => { setActiveTab('sent'); setLoading(true); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'sent' 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sent Emails
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search recipient or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50"
              />
            </div>

            <button
              onClick={() => { setIsComposeOpen(true); }}
              className="py-2.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Compose New Email
            </button>
          </div>
        </section>

        <section className="glass rounded-2xl border border-slate-800/80 overflow-hidden flex-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col divide-y divide-slate-800/40">
              <div className="h-12 bg-slate-900/40 animate-shimmer" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-5 flex items-center justify-between gap-4">
                  <div className="h-4 bg-slate-800/80 w-1/4 rounded animate-pulse" />
                  <div className="h-4 bg-slate-800/80 w-2/5 rounded animate-pulse" />
                  <div className="h-4 bg-slate-800/80 w-1/5 rounded animate-pulse" />
                  <div className="h-4 bg-slate-800/80 w-12 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No emails found</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                {searchQuery 
                  ? "We couldn't find any jobs matching your search parameters." 
                  : activeTab === 'scheduled' 
                    ? "Compose and schedule email campaigns, and they will appear here in pending state."
                    : "No sent or failed email history records found."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                    <th className="py-4 px-6">Recipient Email</th>
                    <th className="py-4 px-6">Campaign Subject</th>
                    <th className="py-4 px-6">{activeTab === 'scheduled' ? 'Scheduled Send Time' : 'Processed Time'}</th>
                    <th className="py-4 px-6">Status</th>
                    {activeTab === 'sent' && <th className="py-4 px-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-sm">
                  {filteredJobs.map((job) => {
                    const previewUrl = getPreviewUrl(job.error);
                    return (
                      <tr 
                        key={job.id} 
                        className="hover:bg-slate-900/20 transition-colors"
                      >
                        <td className="py-4 px-6 font-medium text-slate-200">{job.email}</td>
                        <td className="py-4 px-6 text-slate-400 truncate max-w-xs">{job.subject}</td>
                        <td className="py-4 px-6 text-slate-400">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {activeTab === 'scheduled' ? formatDateTime(job.scheduledAt) : formatDateTime(job.sentAt || job.scheduledAt)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            job.status === 'SENT' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : job.status === 'FAILED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          }`}>
                            {job.status === 'SENT' && 'Sent'}
                            {job.status === 'FAILED' && 'Failed'}
                            {job.status === 'PENDING' && 'Pending'}
                          </span>
                        </td>
                        {activeTab === 'sent' && (
                          <td className="py-4 px-6 text-right">
                            {previewUrl ? (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold hover:underline"
                              >
                                View Preview
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : job.error ? (
                              <span className="text-xs text-rose-400 truncate block max-w-[120px]" title={job.error}>
                                {job.error}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {isComposeOpen && (
        <ComposeModal
          token={token}
          onClose={() => setIsComposeOpen(false)}
          onSuccess={() => {
            setIsComposeOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
