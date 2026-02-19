import re

with open('/var/www/stek/backend/src/modules/wallet/cashier.service.ts', 'r') as f:
    content = f.read()

# Remove the collapsed withdrawal guard lines
collapsed_pattern = r'      // Withdrawal guard: bonusBalance is non-withdrawable \(sticky bonus\).*?;\s*\}'
content = re.sub(collapsed_pattern, '', content)

# Now add proper withdrawal guard after 'const currentBalance = new Decimal(wallet.balance);'
withdrawal_guard = '''
      // Withdrawal guard: bonusBalance is non-withdrawable (sticky bonus)
      const bonusBalance = new Decimal(wallet.bonusBalance || 0);
      const withdrawableBalance = currentBalance.minus(bonusBalance);
      if (withdrawableBalance.lessThan(totalDeduction)) {
        const withdrawableStr = withdrawableBalance.greaterThan(0) ? withdrawableBalance.toFixed(2) : "0.00";
        throw new BadRequestException(
          `Insufficient withdrawable balance. Total: $${currentBalance.toFixed(2)}, Bonus (non-withdrawable): $${bonusBalance.toFixed(2)}, Withdrawable: $${withdrawableStr}`
        );
      }'''

# Find the first occurrence of the balance check and add guard before it
target = '      const currentBalance = new Decimal(wallet.balance);\n      // Step 2: Balance check'
replacement = f'      const currentBalance = new Decimal(wallet.balance);\n{withdrawal_guard}\n      // Step 2: Balance check'

if target in content:
    content = content.replace(target, replacement, 1)
    print("Added withdrawal guard (method 1)")
else:
    # Try alternative
    target2 = 'const currentBalance = new Decimal(wallet.balance);'
    idx = content.find(target2)
    if idx > 0:
        # Find the next line
        next_newline = content.find('\n', idx)
        content = content[:next_newline] + '\n' + withdrawal_guard + content[next_newline:]
        print("Added withdrawal guard (method 2)")
    else:
        print("WARNING: Could not find insertion point!")

with open('/var/www/stek/backend/src/modules/wallet/cashier.service.ts', 'w') as f:
    f.write(content)

print("Done!")
