import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Key, 
  UserCheck, 
  Smartphone, 
  Globe, 
  History, 
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuditLog, SecurityOverview } from '../../types';
import { authFetch } from '../../services/api';

interface SecurityCenterProps {
  onOpenGoogleModal: () => void;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({ onOpenGoogleModal }) => {
  const { user, profile, toggle2FA } = useAuth();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toggling2FA, setToggling2FA] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<string>('all');

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [overviewRes, logsRes] = await Promise.all([
        authFetch('/api/security/overview'),
        authFetch('/api/security/audit-logs')
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setOverview(data);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch security details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleToggle2FA = async () => {
    setToggling2FA(true);
    try {
      await toggle2FA();
      await fetchSecurityData();
    } finally {
      setToggling2FA(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    if (logFilter === 'all') return true;
    return log.event_type === logFilter;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-purple-600 bg-purple-50 border-purple-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-purple-600" />
            Security & Compliance Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time tenant isolation, cryptography parameters, and auditable event tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSecurityData}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit Log</span>
          </button>
        </div>
      </div>

      {/* Security Health & Conditions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dynamic Security Score Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Health Score
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(overview?.securityScore || 85)}`}>
              {overview?.securityScore || 85}/100
            </span>
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-black text-gray-900">
              {overview?.securityScore && overview.securityScore >= 90 ? 'Hardened' : 'Strong'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Derived from 2FA activation, SHA-256 vault checksums, and tenant isolation policies.
            </p>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-4">
            <div
              className="bg-purple-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${overview?.securityScore || 85}%` }}
            />
          </div>
        </div>

        {/* 2FA Configuration */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Two-Factor Auth
            </span>
            <Smartphone className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-bold text-gray-900">
              {profile?.two_factor_enabled ? 'Active (TOTP/Push)' : 'Disabled'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Add a mandatory cryptographic verification layer on authentication.
            </p>
          </div>
          <button
            onClick={handleToggle2FA}
            disabled={toggling2FA}
            className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
              profile?.two_factor_enabled
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            {toggling2FA ? 'Updating...' : profile?.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </div>

        {/* Google OAuth & Identity Provider */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Identity Provider
            </span>
            <Key className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-bold text-gray-900 capitalize">
              {user?.auth_provider || 'Email/Password'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              OpenID Connect / Google OAuth single sign-on integration.
            </p>
          </div>
          <button
            onClick={onOpenGoogleModal}
            className="mt-4 w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Check OAuth Configuration
          </button>
        </div>
      </div>

      {/* Security Events & Guardrails */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-purple-600" />
          Tenant Storage & Cryptographic Parameters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 font-medium">Vault Storage Path</span>
            <p className="font-mono font-semibold text-gray-800 mt-1 truncate">/storage/vault/{user?.id}</p>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 font-medium">Data Integrity</span>
            <p className="font-semibold text-gray-800 mt-1">SHA-256 Checksums</p>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 font-medium">Signed Ticket TTL</span>
            <p className="font-semibold text-gray-800 mt-1">120 Seconds (HMAC-SHA256)</p>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 font-medium">File Execution Protection</span>
            <p className="font-semibold text-emerald-600 mt-1">CSP Sandbox + Nosniff</p>
          </div>
        </div>
      </div>

      {/* Real Audit Logs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              Audit Log Trail
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Immutable user-scoped event records with IP and user agent stamps.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100 text-xs">
            {['all', 'upload', 'download', 'login', 'delete'].map((filter) => (
              <button
                key={filter}
                onClick={() => setLogFilter(filter)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                  logFilter === filter
                    ? 'bg-white text-purple-600 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="py-2.5 px-3">Event</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/60">
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-gray-800 uppercase tracking-wider font-mono text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                      {log.event_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-700 font-medium truncate max-w-sm">
                    {log.details}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-gray-500">
                    {log.ip_address}
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {log.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
