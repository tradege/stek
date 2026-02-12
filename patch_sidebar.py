filepath = "frontend/src/components/admin/AdminSidebar.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Add Palette to imports
content = content.replace(
    "  ScrollText,\n} from 'lucide-react';",
    "  ScrollText,\n  Palette,\n} from 'lucide-react';"
)

# Add brand-settings nav item before god-mode
old_god = """    {
      id: 'god-mode',"""

new_with_brand = """    {
      id: 'brand-settings',
      label: 'Brand Settings',
      icon: <Palette className="w-5 h-5" />,
      href: '/admin/brand-settings',
    },
    {
      id: 'god-mode',"""

content = content.replace(old_god, new_with_brand)

with open(filepath, "w") as f:
    f.write(content)

print("Done!")
