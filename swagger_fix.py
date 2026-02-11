import os
os.chdir('/var/www/stek/backend')

# Fix main.ts to add x-site-id header to all Swagger endpoints
with open('src/main.ts', 'r') as f:
    content = f.read()

if 'x-site-id' not in content:
    content = content.replace(
        "const document = SwaggerModule.createDocument(app, swaggerConfig);",
        """const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Add global x-site-id header parameter to all endpoints
  for (const path of Object.values(document.paths || {})) {
    for (const method of Object.values(path as any)) {
      if (typeof method === 'object' && method !== null) {
        (method as any).parameters = (method as any).parameters || [];
        (method as any).parameters.push({
          name: 'x-site-id',
          in: 'header',
          required: false,
          description: 'Brand/Site ID for multi-tenant isolation. Auto-detected from domain if not provided.',
          schema: { type: 'string', example: 'default-site-001' },
        });
      }
    }
  }"""
    )
    with open('src/main.ts', 'w') as f:
        f.write(content)
    print("Added x-site-id header to Swagger docs")
else:
    print("x-site-id already in Swagger config")
