filepath = "backend/src/modules/auth/jwt.strategy.ts"

with open(filepath, "r") as f:
    content = f.read()

# Add siteId to the select clause
old = """        tokenVersion: true,
      },"""

new = """        tokenVersion: true,
        siteId: true,
      },"""

content = content.replace(old, new)

with open(filepath, "w") as f:
    f.write(content)

print("Done! Added siteId to JWT strategy select")
