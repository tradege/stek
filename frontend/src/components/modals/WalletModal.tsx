'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowUpIcon, ArrowDownIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'history'>('overview');

  const primaryBalance = user?.wallets?.find(w => w.currency === 'USDT');

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="text-3xl">💰</span>
                    Wallet
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-700">
                  {[
                    { id: 'overview', label: 'Overview', icon: '📊' },
                    { id: 'deposit', label: 'Deposit', icon: '⬇️' },
                    { id: 'withdraw', label: 'Withdraw', icon: '⬆️' },
                    { id: 'history', label: 'History', icon: '📜' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2 font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'text-purple-400 border-b-2 border-purple-400'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="min-h-[400px]">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Balance Card */}
                      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6">
                        <div className="text-sm text-purple-100 mb-2">Total Balance</div>
                        <div className="text-4xl font-bold text-white mb-4">
                          ₮ {primaryBalance?.available || '0.00'} USDT
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <div className="text-xs text-purple-200">Available</div>
                            <div className="text-lg font-semibold text-white">
                              ₮ {primaryBalance?.available || '0.00'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-purple-200">Locked</div>
                            <div className="text-lg font-semibold text-white">
                              ₮ {primaryBalance?.locked || '0.00'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setActiveTab('deposit')}
                          className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-4 transition-colors"
                        >
                          <ArrowDownIcon className="w-6 h-6 mx-auto mb-2" />
                          <div className="font-semibold">Deposit</div>
                        </button>
                        <button
                          onClick={() => setActiveTab('withdraw')}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 transition-colors"
                        >
                          <ArrowUpIcon className="w-6 h-6 mx-auto mb-2" />
                          <div className="font-semibold">Withdraw</div>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'deposit' && (
                    <div className="space-y-4">
                      <div className="bg-slate-800 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Deposit USDT</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-slate-400 mb-2">Network</label>
                            <select className="w-full bg-slate-700 text-white rounded-lg px-4 py-2">
                              <option>TRC20 (Tron)</option>
                              <option>ERC20 (Ethereum)</option>
                              <option>BEP20 (BSC)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-slate-400 mb-2">Deposit Address</label>
                            <div className="bg-slate-700 rounded-lg p-4 font-mono text-sm text-white break-all">
                              TXyz123...abc789
                            </div>
                            <button className="mt-2 text-purple-400 hover:text-purple-300 text-sm">
                              📋 Copy Address
                            </button>
                          </div>
                          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                            <p className="text-yellow-400 text-sm">
                              ⚠️ Only send USDT to this address. Sending other assets may result in permanent loss.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'withdraw' && (
                    <div className="space-y-4">
                      <div className="bg-slate-800 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Withdraw USDT</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-slate-400 mb-2">Amount</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2"
                            />
                            <div className="text-xs text-slate-400 mt-1">
                              Available: ₮ {primaryBalance?.available || '0.00'} USDT
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-slate-400 mb-2">Withdrawal Address</label>
                            <input
                              type="text"
                              placeholder="Enter USDT address"
                              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2"
                            />
                          </div>
                          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-3 font-semibold transition-colors">
                            Withdraw
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="space-y-4">
                      <div className="bg-slate-800 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Transaction History</h3>
                        <div className="space-y-3">
                          {[
                            { type: 'deposit', amount: '+100.00', time: '2 hours ago', status: 'completed' },
                            { type: 'withdraw', amount: '-50.00', time: '1 day ago', status: 'completed' },
                            { type: 'deposit', amount: '+200.00', time: '3 days ago', status: 'completed' },
                          ].map((tx, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                              <div className="flex items-center gap-3">
                                {tx.type === 'deposit' ? (
                                  <ArrowDownIcon className="w-5 h-5 text-green-400" />
                                ) : (
                                  <ArrowUpIcon className="w-5 h-5 text-blue-400" />
                                )}
                                <div>
                                  <div className="text-white font-medium capitalize">{tx.type}</div>
                                  <div className="text-xs text-slate-400">{tx.time}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-semibold ${tx.type === 'deposit' ? 'text-green-400' : 'text-blue-400'}`}>
                                  {tx.amount} USDT
                                </div>
                                <div className="text-xs text-green-400">✓ {tx.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
