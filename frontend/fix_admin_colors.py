#!/usr/bin/env python3
"""
Fix all hardcoded Stake-style colors in admin pages to use the proper theme tokens.

Color mapping:
  #1475e1 (Stake blue) -> accent-primary (Electric Cyan #00F0FF)
  #0f212e (Stake dark bg) -> bg-main (#0A0E17)
  #1a2c38 (Stake card bg) -> bg-card (#131B2C) 
  #2f4553 (Stake border) -> white/10
"""

import os
import re
import glob

admin_dir = '/var/www/stek/frontend/src/app/admin'
files = glob.glob(os.path.join(admin_dir, '**/*.tsx'), recursive=True)

# Also include admin components
files += glob.glob('/var/www/stek/frontend/src/components/admin/**/*.tsx', recursive=True)

total_replacements = 0

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    count = 0
    
    # ============================================
    # BACKGROUND COLORS
    # ============================================
    
    # bg-[#1a2c38] -> bg-bg-card (or bg-white/5 for lighter cards)
    content = content.replace('bg-[#1a2c38]', 'bg-bg-card')
    
    # bg-[#0f212e] -> bg-bg-main
    content = content.replace('bg-[#0f212e]', 'bg-bg-main')
    
    # bg-[#0d1b2a] -> bg-bg-main
    content = content.replace('bg-[#0d1b2a]', 'bg-bg-main')
    
    # bg-[#172a3a] -> bg-white/5
    content = content.replace('bg-[#172a3a]', 'bg-white/5')
    
    # bg-[#213743] -> bg-white/5
    content = content.replace('bg-[#213743]', 'bg-white/5')
    
    # bg-[#071824] -> bg-bg-main
    content = content.replace('bg-[#071824]', 'bg-bg-main')
    
    # ============================================
    # ACCENT/PRIMARY COLORS (#1475e1 -> accent-primary)
    # ============================================
    
    # bg-[#1475e1] -> bg-accent-primary
    content = content.replace('bg-[#1475e1]', 'bg-accent-primary')
    
    # text-[#1475e1] -> text-accent-primary
    content = content.replace('text-[#1475e1]', 'text-accent-primary')
    
    # border-[#1475e1] -> border-accent-primary
    content = content.replace('border-[#1475e1]', 'border-accent-primary')
    
    # from-[#1475e1] -> from-accent-primary
    content = content.replace('from-[#1475e1]', 'from-accent-primary')
    
    # to-[#1475e1] -> to-accent-primary
    content = content.replace('to-[#1475e1]', 'to-accent-primary')
    
    # hover:bg-[#1475e1] -> hover:bg-accent-primary
    content = content.replace('hover:bg-[#1475e1]', 'hover:bg-accent-primary')
    
    # hover:border-[#1475e1] -> hover:border-accent-primary
    content = content.replace('hover:border-[#1475e1]', 'hover:border-accent-primary')
    
    # focus:border-[#1475e1] -> focus:border-accent-primary
    content = content.replace('focus:border-[#1475e1]', 'focus:border-accent-primary')
    
    # ============================================
    # BORDER COLORS
    # ============================================
    
    # border-[#2f4553] -> border-white/10
    content = content.replace('border-[#2f4553]', 'border-white/10')
    
    # border-[#1a2c38] -> border-white/10
    content = content.replace('border-[#1a2c38]', 'border-white/10')
    
    # ============================================
    # OPACITY VARIANTS (already using / syntax)
    # ============================================
    
    # from-[#1475e1]/20 -> from-accent-primary/20
    content = re.sub(r'from-\[#1475e1\]/(\d+)', r'from-accent-primary/\1', content)
    
    # to-[#1475e1]/10 -> to-accent-primary/10
    content = re.sub(r'to-\[#1475e1\]/(\d+)', r'to-accent-primary/\1', content)
    
    # border-[#1475e1]/30 -> border-accent-primary/30
    content = re.sub(r'border-\[#1475e1\]/(\d+)', r'border-accent-primary/\1', content)
    
    # bg-[#1475e1]/10 -> bg-accent-primary/10
    content = re.sub(r'bg-\[#1475e1\]/(\d+)', r'bg-accent-primary/\1', content)
    
    # text-[#1475e1]/70 -> text-accent-primary/70
    content = re.sub(r'text-\[#1475e1\]/(\d+)', r'text-accent-primary/\1', content)
    
    # hover:bg-[#1475e1]/90 -> hover:bg-accent-primary/90
    content = re.sub(r'hover:bg-\[#1475e1\]/(\d+)', r'hover:bg-accent-primary/\1', content)
    
    # ============================================
    # SPECIAL: text-[#0f212e] (text on primary buttons) -> text-black
    # ============================================
    content = content.replace('text-[#0f212e]', 'text-black')
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        
        # Count changes
        changes = sum(1 for a, b in zip(original, content) if a != b)
        # Better: count actual replacements
        import difflib
        diff = list(difflib.unified_diff(original.splitlines(), content.splitlines()))
        num_changes = len([l for l in diff if l.startswith('+') and not l.startswith('+++')])
        
        relpath = os.path.relpath(filepath, '/var/www/stek/frontend/src')
        print(f"  Fixed: {relpath} ({num_changes} lines changed)")
        total_replacements += num_changes

print(f"\nTotal: {total_replacements} lines fixed across all files")

# Verify no hardcoded colors remain
remaining = 0
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    for line_num, line in enumerate(content.splitlines(), 1):
        if any(c in line for c in ['#1475e1', '#0f212e', '#1a2c38', '#2f4553', '#0d1b2a', '#172a3a', '#213743', '#071824']):
            remaining += 1

print(f"Remaining hardcoded colors: {remaining}")
