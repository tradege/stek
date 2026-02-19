#!/usr/bin/env python3
"""Add Rewards tab to admin user detail modal"""

filepath = '/var/www/stek/frontend/src/app/admin/users/page.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# 1. Update tab type to include "rewards"
content = content.replace(
    'const [activeTab, setActiveTab] = useState<"info" | "balance" | "bets">("info");',
    'const [activeTab, setActiveTab] = useState<"info" | "balance" | "bets" | "rewards">("info");\n  const [rewards, setRewards] = useState<any[]>([]);\n  const [bonusStats, setBonusStats] = useState<any>(null);'
)

# 2. Add fetchRewards function after fetchBets definition
# Find fetchBets function end
fetch_bets_end = content.find('fetchBets();')
if fetch_bets_end > 0:
    # Add fetchRewards call
    content = content.replace(
        'fetchBets();\n  }, [userId]);',
        'fetchBets();\n    fetchRewards();\n  }, [userId]);'
    )

# 3. Add fetchRewards function - find after fetchBets function
# Find the closing of fetchBets
fetch_rewards_fn = '''
  const fetchRewards = async () => {
    try {
      const [rewardsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users/${userId}/rewards`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/users/${userId}/bonus-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewards(Array.isArray(data) ? data : data.history || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setBonusStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch rewards:", err);
    }
  };
'''

# Insert after fetchBets function
insert_marker = 'const fetchDetail = async () => {'
idx = content.find(insert_marker)
if idx > 0:
    content = content[:idx] + fetch_rewards_fn + '\n  ' + content[idx:]

# 4. Update tab buttons to include "rewards"
content = content.replace(
    '{(["info", "balance", "bets"] as const).map(tab => (',
    '{(["info", "balance", "bets", "rewards"] as const).map(tab => ('
)

content = content.replace(
    'tab === "info" ? "User Info" : tab === "balance" ? "Balance Manager" : "Bet History"',
    'tab === "info" ? "User Info" : tab === "balance" ? "Balance Manager" : tab === "bets" ? "Bet History" : "Rewards"'
)

# 5. Add rewards tab content - find after bets tab closing
# Find the end of bets tab section
bets_tab_end = content.find('{activeTab === "bets" && (')
if bets_tab_end > 0:
    # Find the matching closing bracket - we need to find the end of this block
    # Look for the next activeTab or the closing of the container
    # Let's find the pattern after bets tab
    pass

# Add rewards tab content after bets tab
rewards_tab_content = '''
          {activeTab === "rewards" && (
            <div className="space-y-4 p-4">
              {/* Bonus Stats Summary */}
              {bonusStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
                    <div className="text-green-400 text-xs font-medium mb-1">Bonus Balance</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.bonusBalance || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
                    <div className="text-blue-400 text-xs font-medium mb-1">Total Earned</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.totalEarned || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
                    <div className="text-purple-400 text-xs font-medium mb-1">Rakeback</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.claimableRakeback || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-4 border border-yellow-500/30">
                    <div className="text-yellow-400 text-xs font-medium mb-1">Pool Contributions</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.totalContributed || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
              {/* Rewards History Table */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-white font-semibold">Reward History</h3>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {rewards.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">No rewards yet</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg-card">
                        <tr className="text-text-secondary text-xs">
                          <th className="text-left p-3">Type</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Source</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewards.map((r: any, i: number) => (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                r.type === 'WEEKLY_BONUS' ? 'bg-blue-500/20 text-blue-400' :
                                r.type === 'MONTHLY_BONUS' ? 'bg-purple-500/20 text-purple-400' :
                                r.type === 'RAKEBACK' ? 'bg-green-500/20 text-green-400' :
                                r.type === 'LEVEL_UP' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {r.type?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-green-400">+${Number(r.amount || 0).toFixed(2)}</td>
                            <td className="p-3 text-text-secondary">{r.source || r.gameType || '-'}</td>
                            <td className="p-3 text-text-secondary">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() + ' ' + new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                r.status === 'CREDITED' ? 'bg-green-500/20 text-green-400' :
                                r.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {r.status || 'CREDITED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
'''

# Find the closing of bets tab to insert after it
# Look for the pattern after bets tab content
# The bets tab section ends with a specific pattern
import re

# Find the bets tab section
bets_start = content.find('{activeTab === "bets" && (')
if bets_start > 0:
    # Count parentheses to find the end
    depth = 0
    pos = bets_start
    found_open = False
    while pos < len(content):
        if content[pos] == '(' and found_open:
            depth += 1
        elif content[pos] == '(':
            depth += 1
            found_open = True
        elif content[pos] == ')':
            depth -= 1
            if depth == 0 and found_open:
                # Found the end - look for the closing )}
                close_pos = pos + 1
                # Skip whitespace and find the closing }
                while close_pos < len(content) and content[close_pos] in ' \n\t':
                    close_pos += 1
                if content[close_pos] == '}':
                    # Insert rewards tab after this
                    insert_pos = close_pos + 1
                    content = content[:insert_pos] + '\n' + rewards_tab_content + content[insert_pos:]
                    print(f"Inserted rewards tab at position {insert_pos}")
                break
        pos += 1

with open(filepath, 'w') as f:
    f.write(content)

print("Done! Rewards tab added to admin users page")
