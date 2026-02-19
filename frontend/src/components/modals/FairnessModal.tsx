'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { useAuth } from '@/contexts/AuthContext';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface SeedInfo {
  seedHash: string;
  nonce: number;
  clientSeed: string;
  createdAt: string;
}

interface RotateResult {
  revealedSeed: string;
  revealedSeedHash: string;
  revealedNonce: number;
  newSeedHash: string;
  newNonce: number;
}

interface VerifyResult {
  verified: boolean;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  gameType: string;
  result: any;
}

interface FairnessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'seeds' | 'verify' | 'how';

const FairnessModal: React.FC<FairnessModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('seeds');
  const [seedInfo, setSeedInfo] = useState<SeedInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Seed management state
  const [newClientSeed, setNewClientSeed] = useState('');
  const [rotateResult, setRotateResult] = useState<RotateResult | null>(null);

  // Verification state
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('');
  const [verifyNonce, setVerifyNonce] = useState('');
  const [verifyGame, setVerifyGame] = useState('dice');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const fetchSeeds = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/fairness/seeds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSeedInfo(data);
      } else {
        setError('Failed to load seed information');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && token) {
      fetchSeeds();
      setRotateResult(null);
      setVerifyResult(null);
      setSuccess('');
      setError('');
    }
  }, [isOpen, token, fetchSeeds]);

  const handleRotateSeed = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/fairness/rotate-seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRotateResult(data);
        setSuccess('Server seed rotated! Your previous seed has been revealed below.');
        await fetchSeeds();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Failed to rotate seed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetClientSeed = async () => {
    if (!token || !newClientSeed.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/fairness/client-seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientSeed: newClientSeed.trim() }),
      });
      if (res.ok) {
        setSuccess('Client seed updated!');
        setNewClientSeed('');
        await fetchSeeds();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Failed to set client seed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyServerSeed || !verifyClientSeed || !verifyNonce) {
      setError('Please fill in all verification fields');
      return;
    }
    setLoading(true);
    setError('');
    setVerifyResult(null);
    try {
      const res = await fetch(`${API_URL}/fairness/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serverSeed: verifyServerSeed,
          clientSeed: verifyClientSeed,
          nonce: parseInt(verifyNonce),
          game: verifyGame,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerifyResult(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Verification failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const tabClasses = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-accent-primary text-white'
        : 'text-text-secondary hover:text-white hover:bg-white/5'
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Provably Fair</h2>
            <p className="text-xs text-text-secondary">Verify every bet is fair and unmanipulated</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('seeds')} className={tabClasses('seeds')}>
            Seeds
          </button>
          <button onClick={() => setActiveTab('verify')} className={tabClasses('verify')}>
            Verify
          </button>
          <button onClick={() => setActiveTab('how')} className={tabClasses('how')}>
            How It Works
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Seeds Tab */}
        {activeTab === 'seeds' && (
          <div className="space-y-4">
            {/* Current Seeds */}
            {seedInfo && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Server Seed Hash (SHA-256)</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-black/30 rounded-lg text-xs text-accent-primary font-mono break-all">
                      {seedInfo.seedHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(seedInfo.seedHash)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                      title="Copy"
                    >
                      <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Current Nonce</label>
                    <div className="p-2 bg-black/30 rounded-lg text-sm text-white font-mono">
                      {seedInfo.nonce}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Total Bets</label>
                    <div className="p-2 bg-black/30 rounded-lg text-sm text-white font-mono">
                      {seedInfo.nonce}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Set Client Seed */}
            <div className="pt-3 border-t border-white/10">
              <label className="block text-xs text-text-secondary mb-1">Custom Client Seed</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClientSeed}
                  onChange={(e) => setNewClientSeed(e.target.value)}
                  placeholder="Enter your own client seed..."
                  className="flex-1 p-2 bg-black/30 rounded-lg text-sm text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
                <button
                  onClick={handleSetClientSeed}
                  disabled={loading || !newClientSeed.trim()}
                  className="px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium text-white hover:bg-accent-primary/80 disabled:opacity-50 transition-colors"
                >
                  Set
                </button>
              </div>
            </div>

            {/* Rotate Seed */}
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-text-secondary mb-2">
                Rotating reveals your current server seed for verification and generates a new one.
              </p>
              <button
                onClick={handleRotateSeed}
                disabled={loading}
                className="w-full py-2.5 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-sm font-medium text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Rotating...' : 'Rotate Server Seed'}
              </button>
            </div>

            {/* Revealed Seed */}
            {rotateResult && (
              <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg space-y-2">
                <p className="text-xs font-medium text-green-400">Previous Seed Revealed:</p>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Server Seed</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-black/30 rounded text-xs text-green-400 font-mono break-all">
                      {rotateResult.revealedSeed}
                    </code>
                    <button
                      onClick={() => copyToClipboard(rotateResult.revealedSeed)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors shrink-0"
                    >
                      <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Hash (verify it matches)</label>
                  <code className="block p-2 bg-black/30 rounded text-xs text-text-secondary font-mono break-all">
                    {rotateResult.revealedSeedHash}
                  </code>
                </div>
                <div className="text-xs text-text-secondary">
                  Bets made with this seed: <span className="text-white font-mono">{rotateResult.revealedNonce}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verify Tab */}
        {activeTab === 'verify' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Game Type</label>
              <select
                value={verifyGame}
                onChange={(e) => setVerifyGame(e.target.value)}
                className="w-full p-2 bg-black/30 rounded-lg text-sm text-white border border-white/10 focus:border-accent-primary focus:outline-none"
              >
                <option value="dice">Dice</option>
                <option value="plinko">Plinko</option>
                <option value="mines">Mines</option>
                <option value="limbo">Limbo</option>
                <option value="card-rush">Card Rush</option>
                <option value="penalty">Penalty</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Server Seed (revealed after rotation)</label>
              <input
                type="text"
                value={verifyServerSeed}
                onChange={(e) => setVerifyServerSeed(e.target.value)}
                placeholder="Enter server seed..."
                className="w-full p-2 bg-black/30 rounded-lg text-sm text-white border border-white/10 focus:border-accent-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Client Seed</label>
              <input
                type="text"
                value={verifyClientSeed}
                onChange={(e) => setVerifyClientSeed(e.target.value)}
                placeholder="Enter client seed..."
                className="w-full p-2 bg-black/30 rounded-lg text-sm text-white border border-white/10 focus:border-accent-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Nonce</label>
              <input
                type="number"
                value={verifyNonce}
                onChange={(e) => setVerifyNonce(e.target.value)}
                placeholder="Enter nonce..."
                className="w-full p-2 bg-black/30 rounded-lg text-sm text-white border border-white/10 focus:border-accent-primary focus:outline-none font-mono"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full py-2.5 bg-accent-primary rounded-lg text-sm font-medium text-white hover:bg-accent-primary/80 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Result'}
            </button>

            {/* Verification Result */}
            {verifyResult && (
              <div className={`p-3 rounded-lg border ${
                verifyResult.verified
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {verifyResult.verified ? (
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className={`text-sm font-medium ${verifyResult.verified ? 'text-green-400' : 'text-red-400'}`}>
                    {verifyResult.verified ? 'Verified - Result is fair!' : 'Verification failed'}
                  </span>
                </div>

                {verifyResult.result && (
                  <div className="mt-2 p-2 bg-black/30 rounded text-xs font-mono text-text-secondary">
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(verifyResult.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* How It Works Tab */}
        {activeTab === 'how' && (
          <div className="space-y-4 text-sm text-text-secondary">
            <div className="p-4 bg-black/20 rounded-lg space-y-3">
              <h3 className="text-white font-medium">What is Provably Fair?</h3>
              <p>
                Provably Fair is a cryptographic system that allows you to verify that every game result
                was determined fairly and was not manipulated by the house.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-accent-primary">1</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Before the bet</p>
                  <p className="text-xs mt-1">
                    The server generates a secret seed and shows you its SHA-256 hash. This commits the server
                    to the seed without revealing it.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-accent-primary">2</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">During the bet</p>
                  <p className="text-xs mt-1">
                    The game result is calculated using: <code className="text-accent-primary">HMAC-SHA256(serverSeed, clientSeed:nonce)</code>.
                    The nonce increments with each bet, ensuring unique results.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-accent-primary">3</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">After rotation</p>
                  <p className="text-xs mt-1">
                    When you rotate the server seed, the old seed is revealed. You can then verify that
                    its hash matches what was shown before, and recalculate all past results.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                <strong>Tip:</strong> Set your own client seed before playing to add your own randomness
                to the result. This makes it mathematically impossible for anyone to predict or manipulate outcomes.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default FairnessModal;
