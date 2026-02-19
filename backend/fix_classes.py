import os

def fix_methods_outside_class(filepath, methods_marker):
    """Move methods that were appended after the class closing brace back inside it."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    if methods_marker not in content:
        print(f"  {filepath}: No fix needed (marker not found)")
        return
    
    # Split at the marker
    parts = content.split(methods_marker, 1)
    if len(parts) != 2:
        print(f"  {filepath}: Could not split")
        return
    
    before_marker = parts[0]
    methods_and_after = methods_marker + parts[1]
    
    # Find the last closing brace of the class (should be right before the marker)
    # Remove trailing whitespace/newlines from before_marker
    before_stripped = before_marker.rstrip()
    
    if before_stripped.endswith('}'):
        # Remove the last } and add methods before it
        before_without_brace = before_stripped[:-1]
        content = before_without_brace + '\n' + methods_and_after.rstrip() + '\n}\n'
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  {filepath}: Fixed - moved methods inside class")
    else:
        print(f"  {filepath}: Last char before marker is '{before_stripped[-1]}', not '}}'. Manual fix needed.")

def fix_postbet_outside_class(filepath):
    """Fix postBetProcessing method that was appended outside the class."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    marker = '  // ============================================\n  // POST-BET PROCESSING: VIP + RewardPool + Affiliate'
    if marker not in content:
        # Try alternate marker
        marker = '  private async postBetProcessing('
        if marker not in content:
            print(f"  {filepath}: No postBetProcessing found")
            return
    
    # Find where the method starts
    idx = content.find(marker)
    before = content[:idx]
    method_and_after = content[idx:]
    
    before_stripped = before.rstrip()
    if before_stripped.endswith('}'):
        # Remove the class closing brace
        before_without_brace = before_stripped[:-1]
        # Make sure method ends with class closing brace
        if not method_and_after.rstrip().endswith('}'):
            method_and_after = method_and_after.rstrip() + '\n}\n'
        content = before_without_brace + '\n\n' + method_and_after
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  {filepath}: Fixed postBetProcessing placement")
    else:
        print(f"  {filepath}: Already inside class or different structure")

# Fix admin service
print("Fixing admin.service.ts...")
fix_methods_outside_class(
    '/var/www/stek/backend/src/modules/admin/admin.service.ts',
    '  // ============================================\n  // REWARD POOL ADMIN METHODS'
)

# Fix game services with postBetProcessing
games = ['card-rush/card-rush', 'limbo/limbo', 'olympus/olympus', 'penalty/penalty']
for game in games:
    filepath = f'/var/www/stek/backend/src/modules/{game}.service.ts'
    print(f"Fixing {game}...")
    fix_postbet_outside_class(filepath)

print("\nAll fixes applied!")
