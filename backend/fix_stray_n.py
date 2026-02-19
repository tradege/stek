import re

files = [
    '/var/www/stek/backend/src/modules/crash/crash.service.ts',
    '/var/www/stek/backend/src/modules/limbo/limbo.service.ts',
    '/var/www/stek/backend/src/modules/dice/dice.service.ts',
    '/var/www/stek/backend/src/modules/mines/mines.service.ts',
    '/var/www/stek/backend/src/modules/card-rush/card-rush.service.ts',
    '/var/www/stek/backend/src/modules/penalty/penalty.service.ts',
    '/var/www/stek/backend/src/modules/plinko/plinko.service.ts',
    '/var/www/stek/backend/src/modules/olympus/olympus.service.ts',
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        fixed = False
        new_lines = []
        for i, line in enumerate(lines):
            # Remove lines that are just 'n' (stray newline artifacts from sed)
            if line.strip() == 'n':
                fixed = True
                continue
            # Remove leading 'n' before comments that were artifacts
            if re.match(r'^n\s+//', line):
                line = line[1:]  # Remove the leading 'n'
                fixed = True
            new_lines.append(line)
        
        if fixed:
            with open(filepath, 'w') as f:
                f.writelines(new_lines)
            print(f"Fixed: {filepath}")
        else:
            print(f"OK: {filepath}")
    except Exception as e:
        print(f"Error: {filepath}: {e}")

# Also fix olympus line 593 issue - the postBetProcessing call was added outside the transaction
# Let's check and fix
with open('/var/www/stek/backend/src/modules/olympus/olympus.service.ts', 'r') as f:
    content = f.read()

# Find the misplaced line at ~593
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    # Remove duplicate postBetProcessing calls that are outside the class context
    if 'this.postBetProcessing' in line:
        # Check if this is inside a method (indented properly)
        indent = len(line) - len(line.lstrip())
        if indent < 4:  # Outside class context
            print(f"Removing misplaced postBetProcessing at line {i+1}")
            continue
    new_lines.append(line)

with open('/var/www/stek/backend/src/modules/olympus/olympus.service.ts', 'w') as f:
    f.write('\n'.join(new_lines))

print("Done!")
