filepath = "backend/src/modules/super-admin/super-admin.service.ts"

with open(filepath, "r") as f:
    lines = f.readlines()

new_methods = """  // ============================================
  // TENANT COLOR MANAGEMENT
  // ============================================
  async updateTenantColors(siteId: string, userId: string, colors: {
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
    const site = await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.adminUserId !== userId) {
      throw new BadRequestException('You are not the admin of this brand');
    }
    const colorFields = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'cardColor', 'dangerColor'];
    for (const field of colorFields) {
      if (colors[field] && !/^#[0-9A-Fa-f]{6}$/.test(colors[field])) {
        throw new BadRequestException('Invalid color format for ' + field + '. Use hex #RRGGBB');
      }
    }
    const updateData: any = {};
    for (const [key, value] of Object.entries(colors)) {
      if (value !== undefined && value !== null) updateData[key] = value;
    }
    const updated = await this.prisma.siteConfiguration.update({ where: { id: siteId }, data: updateData });
    return {
      success: true,
      message: 'Brand colors updated successfully',
      colors: {
        primaryColor: updated.primaryColor, secondaryColor: updated.secondaryColor,
        accentColor: updated.accentColor, backgroundColor: updated.backgroundColor,
        cardColor: updated.cardColor, dangerColor: updated.dangerColor,
        logoUrl: updated.logoUrl, faviconUrl: updated.faviconUrl,
        heroImageUrl: updated.heroImageUrl, backgroundImageUrl: updated.backgroundImageUrl,
      },
    };
  }

  async getTenantBrandSettings(siteId: string, userId: string) {
    const site = await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.adminUserId !== userId) {
      throw new BadRequestException('You are not the admin of this brand');
    }
    return {
      brandName: site.brandName, domain: site.domain,
      primaryColor: site.primaryColor, secondaryColor: site.secondaryColor,
      accentColor: site.accentColor, backgroundColor: site.backgroundColor,
      cardColor: site.cardColor, dangerColor: site.dangerColor,
      logoUrl: site.logoUrl, faviconUrl: site.faviconUrl,
      heroImageUrl: site.heroImageUrl, backgroundImageUrl: site.backgroundImageUrl,
      locale: site.locale, jurisdiction: site.jurisdiction,
    };
  }

  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const specials = '!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    password += specials.charAt(Math.floor(Math.random() * specials.length));
    password += Math.floor(Math.random() * 10);
    return password;
  }

"""

# Find the line with "  // HELPERS" and insert before it
insert_idx = None
for i, line in enumerate(lines):
    if "// HELPERS" in line and "============" not in line:
        # Go back to the separator line
        insert_idx = i - 1
        break

if insert_idx is None:
    # Try finding the separator + HELPERS pattern
    for i, line in enumerate(lines):
        if "// HELPERS" in line:
            insert_idx = i - 1 if i > 0 and "====" in lines[i-1] else i
            break

if insert_idx is not None:
    new_lines = lines[:insert_idx] + [new_methods] + lines[insert_idx:]
    with open(filepath, "w") as f:
        f.writelines(new_lines)
    print(f"Methods inserted at line {insert_idx}. File saved!")
else:
    # Fallback: insert before the last closing brace
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip() == "}":
            new_lines = lines[:i] + [new_methods] + lines[i:]
            with open(filepath, "w") as f:
                f.writelines(new_lines)
            print(f"Methods inserted before closing brace at line {i}. File saved!")
            break
