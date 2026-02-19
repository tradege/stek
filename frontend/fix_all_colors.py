#!/usr/bin/env python3
"""
Fix ALL hardcoded Stake-style colors across the ENTIRE frontend.
Covers: admin pages, super-admin, game pages, game components, modals, UI components.

Color mapping:
  #1475e1 -> accent-primary (#00F0FF)
  #0f212e -> bg-main (#0A0E17)
  #0f1923 -> bg-main (#0A0E17)
  #1a2c38 -> bg-card (#131B2C)
  #2f4553 -> white/10
  #3d5a6e -> white/20
  #0d1b2a -> bg-main
  #172a3a -> white/5
  #213743 -> white/5
  #071824 -> bg-main
"""

import os
import re
import glob

# Scan ALL tsx files in the frontend
base = '/var/www/stek/frontend/src'
files = glob.glob(os.path.join(base, '**/*.tsx'), recursive=True)
# Exclude test files
files = [f for f in files if '__tests__' not in f and 'node_modules' not in f]

total_files_fixed = 0
total_replacements = 0

replacements = [
    # Background colors
    ('bg-[#1a2c38]', 'bg-bg-card'),
    ('bg-[#0f212e]', 'bg-bg-main'),
    ('bg-[#0f1923]', 'bg-bg-main'),
    ('bg-[#0d1b2a]', 'bg-bg-main'),
    ('bg-[#071824]', 'bg-bg-main'),
    ('bg-[#172a3a]', 'bg-white/5'),
    ('bg-[#213743]', 'bg-white/5'),
    ('bg-[#2f4553]', 'bg-white/10'),
    ('bg-[#3d5a6e]', 'bg-white/20'),
    
    # Hover backgrounds
    ('hover:bg-[#1a2c38]', 'hover:bg-bg-card'),
    ('hover:bg-[#0f212e]', 'hover:bg-bg-main'),
    ('hover:bg-[#0f1923]', 'hover:bg-bg-main'),
    ('hover:bg-[#2f4553]', 'hover:bg-white/10'),
    ('hover:bg-[#3d5a6e]', 'hover:bg-white/20'),
    ('hover:bg-[#213743]', 'hover:bg-white/10'),
    
    # Border colors
    ('border-[#2f4553]', 'border-white/10'),
    ('border-[#1a2c38]', 'border-white/10'),
    ('border-[#0f212e]', 'border-white/5'),
    ('border-[#3d5a6e]', 'border-white/20'),
    
    # Hover borders
    ('hover:border-[#2f4553]', 'hover:border-white/10'),
    ('hover:border-[#3d5a6e]', 'hover:border-white/20'),
    
    # Focus borders
    ('focus:border-[#1475e1]', 'focus:border-accent-primary'),
    ('focus:border-[#2f4553]', 'focus:border-white/20'),
    
    # Focus ring
    ('focus:ring-[#1475e1]', 'focus:ring-accent-primary'),
    
    # Divide
    ('divide-[#2f4553]', 'divide-white/10'),
    
    # Accent/Primary color (#1475e1)
    ('bg-[#1475e1]', 'bg-accent-primary'),
    ('text-[#1475e1]', 'text-accent-primary'),
    ('border-[#1475e1]', 'border-accent-primary'),
    ('from-[#1475e1]', 'from-accent-primary'),
    ('to-[#1475e1]', 'to-accent-primary'),
    ('via-[#1475e1]', 'via-accent-primary'),
    ('hover:bg-[#1475e1]', 'hover:bg-accent-primary'),
    ('hover:text-[#1475e1]', 'hover:text-accent-primary'),
    ('hover:border-[#1475e1]', 'hover:border-accent-primary'),
    
    # Text on dark bg
    ('text-[#0f212e]', 'text-black'),
    ('text-[#0f1923]', 'text-black'),
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Apply all simple replacements
    for old, new in replacements:
        content = content.replace(old, new)
    
    # Handle opacity variants with regex
    # from-[#1475e1]/XX -> from-accent-primary/XX
    content = re.sub(r'from-\[#1475e1\]/(\d+)', r'from-accent-primary/\1', content)
    content = re.sub(r'to-\[#1475e1\]/(\d+)', r'to-accent-primary/\1', content)
    content = re.sub(r'via-\[#1475e1\]/(\d+)', r'via-accent-primary/\1', content)
    content = re.sub(r'border-\[#1475e1\]/(\d+)', r'border-accent-primary/\1', content)
    content = re.sub(r'bg-\[#1475e1\]/(\d+)', r'bg-accent-primary/\1', content)
    content = re.sub(r'text-\[#1475e1\]/(\d+)', r'text-accent-primary/\1', content)
    content = re.sub(r'hover:bg-\[#1475e1\]/(\d+)', r'hover:bg-accent-primary/\1', content)
    
    # Handle #2f4553 opacity variants
    content = re.sub(r'border-\[#2f4553\]/(\d+)', r'border-white/10', content)
    content = re.sub(r'divide-\[#2f4553\]/(\d+)', r'divide-white/10', content)
    content = re.sub(r'bg-\[#2f4553\]/(\d+)', r'bg-white/10', content)
    
    # Handle #1a2c38 opacity variants
    content = re.sub(r'border-\[#1a2c38\]/(\d+)', r'border-white/10', content)
    
    # Handle #0f1923 opacity variants
    content = re.sub(r'border-\[#0f1923\]/(\d+)', r'border-white/5', content)
    
    # Fix text-gray-400 -> text-text-secondary in admin/super-admin pages only
    if '/admin/' in filepath or '/super-admin/' in filepath:
        content = content.replace('text-gray-400', 'text-text-secondary')
        content = content.replace('text-gray-500', 'text-text-tertiary')
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        
        relpath = os.path.relpath(filepath, base)
        # Count changed lines
        orig_lines = original.splitlines()
        new_lines = content.splitlines()
        changed = sum(1 for a, b in zip(orig_lines, new_lines) if a != b)
        changed += abs(len(orig_lines) - len(new_lines))
        
        print(f"  Fixed: {relpath} ({changed} lines)")
        total_files_fixed += 1
        total_replacements += changed

print(f"\n{'='*50}")
print(f"Total: {total_files_fixed} files fixed, {total_replacements} lines changed")

# Verify remaining
remaining = 0
remaining_files = {}
for filepath in files:
    with open(filepath, 'r') as f:
        for line_num, line in enumerate(f, 1):
            if any(c in line for c in ['#1475e1', '#0f212e', '#1a2c38', '#2f4553', '#0d1b2a', '#172a3a', '#213743', '#071824', '#0f1923', '#3d5a6e']):
                remaining += 1
                relpath = os.path.relpath(filepath, base)
                if relpath not in remaining_files:
                    remaining_files[relpath] = []
                remaining_files[relpath].append(f"  L{line_num}: {line.strip()[:100]}")

print(f"\nRemaining hardcoded colors: {remaining}")
if remaining_files:
    for f, lines in remaining_files.items():
        print(f"\n  {f}:")
        for l in lines[:3]:
            print(f"    {l}")
