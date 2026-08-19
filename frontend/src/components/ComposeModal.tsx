import { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';

interface ComposeModalProps {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function ComposeModal({ token, onClose, onSuccess }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(10);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = text.match(emailRegex) || [];
        const uniqueEmails = Array.from(new Set(matches.map(email => email.trim().toLowerCase())));
        
        if (uniqueEmails.length === 0) {
          setError('No valid email addresses detected in the uploaded file.');
          setEmails([]);
          setFileName(null);
        } else {
          setEmails(uniqueEmails);
        }
      } catch (err) {
        console.error('File parsing error:', err);
        setError('Failed to parse file. Please ensure it is CSV or TXT.');
      }
    };
    reader.readAsText(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emails.length === 0) {
      setError('Please upload a file with email addresses.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        subject,
        body,
        recipients: emails,
        startTime: new Date(startTime).toISOString(),
        delaySeconds,
        hourlyLimit,
      };

      const res = await fetch(`${API_URL}/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule campaign');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error('Campaign creation error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-obsidian-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Campaign</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Campaign Scheduled Successfully</h3>
            <p className="text-sm text-slate-400">Emails are queued and will process based on your configuration.</p>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Subject</label>
              <input
                type="text"
                placeholder="e.g. Redefining your sales pipeline with AI"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Body (HTML supported)</label>
              <textarea
                placeholder="Write your email template details here..."
                required
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 font-sans resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upload Lead List (CSV / TXT)</label>
              
              {fileName ? (
                <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white truncate max-w-[240px]">{fileName}</p>
                      <p className="text-xs text-slate-500 font-semibold">{emails.length} unique email addresses detected</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFileName(null); setEmails([]); }}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative border border-dashed border-slate-800 hover:border-brand-500/50 hover:bg-brand-500/5 rounded-xl transition-all p-6 flex flex-col items-center justify-center text-center cursor-pointer group">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    required
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-brand-400 mb-2 transition-colors" />
                  <p className="text-sm font-semibold text-slate-300">Drag & drop or click to upload</p>
                  <p className="text-xs text-slate-500 mt-1">Supports CSV, TXT with email lists</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/40 p-4.5 rounded-2xl border border-slate-800">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider" title="Delay between individual email sends (seconds)">
                  Throttling Delay (s)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider" title="Max emails sent per hour">
                  Hourly Send Limit
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-5 bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-800 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || emails.length === 0}
                className="py-2.5 px-6 bg-gradient-to-r from-brand-600 to-indigo-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Schedule Campaign
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
