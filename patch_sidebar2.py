filepath = "frontend/src/components/admin/AdminSidebar.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Add Palette to imports if not already there
if "Palette" not in content:
    content = content.replace(
        "  ScrollText,\n} from 'lucide-react';",
        "  ScrollText,\n  Palette,\n} from 'lucide-react';"
    )
    print("Added Palette import")

# Add brand-settings nav item before god-mode
# The exact pattern is:
#   },
#   {
#     id: 'god-mode',
if "brand-settings" not in content:
    old = """  {
    id: 'god-mode',
    label: 'God Mode',"""
    
    new = """  {
    id: 'brand-settings',
    label: 'Brand Settings',
    icon: <Palette className="w-5 h-5" />,
    href: '/admin/brand-settings',
  },
  {
    id: 'god-mode',
    label: 'God Mode',"""
    
    content = content.replace(old, new)
    print("Added brand-settings nav item")
else:
    print("brand-settings already exists")

with open(filepath, "w") as f:
    f.write(content)

print("Done!")
