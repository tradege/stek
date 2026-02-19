'use client';
import React, { useState, useEffect } from 'react';
import config from '@/config/api';
import { Shield, Search, Calendar, User, Info } from 'lucide-react';

const API_URL = config.apiUrl;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/admin/audit-logs?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) return <div className="p-8 text-white">Loading audit logs...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="text-blue-400" /> Admin Audit Logs
        </h1>
        <p className="text-text-secondary">Track all administrative actions and changes</p>
      </div>

      <div className="bg-[#1a2235] border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-text-secondary border-b border-gray-800 bg-black/20">
                <th className="p-4 font-medium">Timestamp</th>
                <th className="p-4 font-medium">Admin ID</th>
                <th className="p-4 font-medium">Action</th>
                <th className="p-4 font-medium">Entity</th>
                <th className="p-4 font-medium">Details</th>
                <th className="p-4 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-sm text-gray-300">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-text-tertiary" />
                      <span className="text-sm font-mono">{log.adminId?.substring(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.action.includes('POST') ? 'bg-green-500/20 text-green-400' :
                      log.action.includes('PUT') || log.action.includes('PATCH') ? 'bg-blue-500/20 text-blue-400' :
                      log.action.includes('DELETE') ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-text-secondary'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium">{log.entityType}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => alert(JSON.stringify(log.details, null, 2))}
                      className="text-text-secondary hover:text-white transition-colors"
                    >
                      <Info size={18} />
                    </button>
                  </td>
                  <td className="p-4 text-sm text-text-secondary font-mono">{log.ipAddress}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-tertiary">No audit logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
