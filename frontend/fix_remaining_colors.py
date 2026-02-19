#!/usr/bin/env python3
import glob

base = '/var/www/stek/frontend/src'
files = glob.glob(base + '/**/*.tsx', recursive=True)
files = [f for f in files if '__tests__' not in f]

extra_replacements = [
    ('from-[#0a0e1a]', 'from-bg-main'),
    ('via-[#111827]', 'via-gray-900'),
    ('to-[#0f1923]', 'to-bg-main'),
    ('from-[#1a2c38]', 'from-bg-card'),
    ('via-[#0f1923]', 'via-bg-main'),
    ('from-[#0f212e]', 'from-bg-main'),
    ('from-[#0a0e17]', 'from-bg-main'),
    ('to-[#0d1520]', 'to-bg-main'),
    ('to-[#0d1b24]', 'to-bg-main'),
    ('from-[#0d1b24]', 'from-bg-main'),
    ('border-[#2a3f4d]', 'border-white/10'),
    ('scrollbar-thumb-[#2f4553]', 'scrollbar-thumb-white/20'),
]

count = 0
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    original = content
    for old, new in extra_replacements:
        content = content.replace(old, new)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        count += 1
        short = filepath.replace(base + '/', '')
        print("Fixed: " + short)

print("Fixed " + str(count) + " files")

# Final check
remaining = 0
for filepath in files:
    with open(filepath, 'r') as f:
        for line_num, line in enumerate(f, 1):
            colors = ['#1475e1', '#0f212e', '#1a2c38', '#2f4553', '#0d1b2a', '#172a3a', '#213743', '#071824', '#0f1923', '#3d5a6e', '#0a0e1a', '#0d1b24', '#2a3f4d']
            if any(c in line for c in colors):
                remaining += 1
                short = filepath.replace(base + '/', '')
                print("  REMAINING: " + short + " L" + str(line_num) + ": " + line.strip()[:120])

print("\nTotal remaining: " + str(remaining))
