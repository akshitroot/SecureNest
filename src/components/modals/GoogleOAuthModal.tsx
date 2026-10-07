import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Copy, ExternalLink } from 'lucide-react';

interface GoogleOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleOAuthModal: React.FC<GoogleOAuthModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<{
    configured: boolean;
    clientId: string | null;
    redirectUri: string;
    instructions: {
      step1: string;
      step2: string;
      step3: string;
      step4: string;
    };
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/google/status')
        .then((res) => res.json())
        .then((data) => setStatus(data))
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyRedirectUri = () => {
    if (status?.redirectUri) {
      navigator.clipboard.writeText(status.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg border border-gray-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Google OAuth 2.0 Status</h2>
              <p className="text-xs text-gray-500">Real Google Sign-In with server-side OAuth callback</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {status?.configured ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-900">Google OAuth Configured</h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Server is connected to Google Cloud Client ID ({status.clientId}).
                  </p>
                </div>
              </div>
              <a
                href="/api/auth/google/start"
                className="w-full py-2.5 rounded-xl bg-[#4285F4] hover:bg-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                Authenticate with Google Account Now
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-900">Google Credentials Required</h3>
                  <p className="text-xs text-amber-700 mt-0.5">
                    To enable 1-click Google Single Sign-On, register this application in the Google Cloud Console.
                  </p>
                </div>
              </div>

              {/* Exact instructions required by prompt */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Required Configuration Steps:
                </h4>
                <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                  <li>
                    Create an OAuth 2.0 Web Client in{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-600 font-semibold inline-flex items-center gap-1 hover:underline"
                    >
                      Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    Set <strong>Authorized redirect URIs</strong> to:
                    <div className="mt-1 flex items-center justify-between bg-white p-2 rounded border border-gray-200 font-mono text-[11px] text-gray-800">
                      <span className="truncate">{status?.redirectUri}</span>
                      <button
                        onClick={copyRedirectUri}
                        className="p-1 hover:bg-gray-100 rounded text-purple-600 shrink-0 ml-2"
                        title="Copy URI"
                      >
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </li>
                  <li>
                    Add environment variables to your deployment or <code>.env</code> file:
                    <pre className="bg-gray-900 text-gray-200 p-2.5 rounded-lg text-[10px] mt-1 font-mono overflow-x-auto">
{`GOOGLE_CLIENT_ID="your_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_client_secret"`}
                    </pre>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
