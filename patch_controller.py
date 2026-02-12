filepath = "backend/src/modules/super-admin/super-admin.controller.ts"

with open(filepath, "r") as f:
    content = f.read()

# 1. Add Req import if not present
if "Req," not in content and "@Req()" not in content:
    content = content.replace(
        "  BadRequestException,",
        "  BadRequestException,\n  Req,"
    )
    print("Added Req import")

# 2. Update createTenant body type to include ownerPassword and ownerUsername
old_body = """  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async createTenant(@Body() body: {
    brandName: string;
    domain: string;
    ownerEmail: string;
    ggrFee: number;
    allowedGames: string[];
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    locale?: string;
    jurisdiction?: string;
    licenseType?: string;
  }) {"""

new_body = """  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async createTenant(@Body() body: {
    brandName: string;
    domain: string;
    ownerEmail: string;
    ownerPassword?: string;
    ownerUsername?: string;
    ggrFee: number;
    allowedGames: string[];
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    locale?: string;
    jurisdiction?: string;
    licenseType?: string;
  }) {"""

if old_body in content:
    content = content.replace(old_body, new_body)
    print("Updated createTenant body type")
else:
    print("Could not find createTenant body to update")

# 3. Add brand-settings endpoints before the BANKROLL section
# Find the reports section end (last endpoint) and add before the closing brace
new_endpoints = """
  // ============================================
  // BRAND SETTINGS (for tenant admins)
  // ============================================
  /**
   * Get brand settings for the current admin's site
   */
  @Get('brand-settings')
  async getBrandSettings(@Req() req: any) {
    const user = req.user;
    if (!user.siteId) {
      throw new BadRequestException('No site associated with this admin');
    }
    return this.superAdminService.getTenantBrandSettings(user.siteId, user.id);
  }

  /**
   * Update brand colors for the current admin's site
   */
  @Put('brand-settings')
  async updateBrandSettings(@Req() req: any, @Body() body: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    heroImageUrl?: string;
    backgroundImageUrl?: string;
  }) {
    const user = req.user;
    if (!user.siteId) {
      throw new BadRequestException('No site associated with this admin');
    }
    return this.superAdminService.updateTenantColors(user.siteId, user.id, body);
  }
"""

# Insert before the last closing brace of the class
last_brace = content.rfind("}")
if last_brace != -1:
    content = content[:last_brace] + new_endpoints + "\n" + content[last_brace:]
    print("Added brand-settings endpoints")

with open(filepath, "w") as f:
    f.write(content)

print("Controller patched successfully!")
