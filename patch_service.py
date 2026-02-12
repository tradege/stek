import re
import sys

filepath = "backend/src/modules/super-admin/super-admin.service.ts"

with open(filepath, "r") as f:
    content = f.read()

# 1. Add bcrypt import if not present
if "bcrypt" not in content:
    content = 'import * as bcrypt from "bcrypt";\n' + content
    print("Added bcrypt import")

# 2. Add SALT_ROUNDS after constructor
if "SALT_ROUNDS" not in content:
    content = content.replace(
        "constructor(private readonly prisma: PrismaService) {}",
        "private readonly SALT_ROUNDS = 10;\n\n  constructor(private readonly prisma: PrismaService) {}"
    )
    print("Added SALT_ROUNDS")

# 3. Replace createTenant method
start_marker = "  async createTenant(data: {"
end_marker = "    return { success: true, tenant: site };\n  }"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    
    new_method = '''  async createTenant(data: {
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
  }) {
    const existing = await this.prisma.siteConfiguration.findFirst({
      where: { OR: [{ brandName: data.brandName }, { domain: data.domain.toLowerCase() }] },
    });
    if (existing) {
      throw new BadRequestException(
        existing.brandName === data.brandName ? 'Brand name already exists' : 'Domain already registered',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.ownerEmail.toLowerCase() },
    });
    if (existingUser) {
      throw new BadRequestException('Owner email already registered. Use a unique email for each brand admin.');
    }

    const adminPassword = data.ownerPassword || this.generateSecurePassword();
    const adminUsername = data.ownerUsername || data.brandName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin';

    const result = await this.prisma.$transaction(async (tx) => {
      const site = await tx.siteConfiguration.create({
        data: {
          brandName: data.brandName,
          domain: data.domain.toLowerCase(),
          primaryColor: data.primaryColor || '#00F0FF',
          secondaryColor: data.secondaryColor || '#131B2C',
          accentColor: data.accentColor || '#00D46E',
          backgroundColor: data.backgroundColor || '#0A0E17',
          cardColor: data.cardColor || '#131B2C',
          dangerColor: data.dangerColor || '#FF385C',
          logoUrl: data.logoUrl,
          locale: data.locale || 'en',
          jurisdiction: data.jurisdiction,
          licenseType: data.licenseType,
          houseEdgeConfig: {
            ggrFee: data.ggrFee,
            allowedGames: data.allowedGames,
            crash: 0.04, dice: 0.04, mines: 0.04, plinko: 0.04,
            limbo: 0.04, penalty: 0.04, olympus: 0.04, cardRush: 0.04,
          },
          gameAssets: {},
        },
      });

      const passwordHash = await bcrypt.hash(adminPassword, this.SALT_ROUNDS);
      const adminUser = await tx.user.create({
        data: {
          username: adminUsername.toLowerCase(),
          email: data.ownerEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          displayName: data.brandName + ' Admin',
          siteId: site.id,
          hierarchyPath: '/',
          hierarchyLevel: 1,
        },
      });

      await tx.wallet.create({
        data: {
          userId: adminUser.id,
          currency: 'USDT',
          balance: 0,
          lockedBalance: 0,
          siteId: site.id,
        },
      });

      await tx.siteConfiguration.update({
        where: { id: site.id },
        data: { adminUserId: adminUser.id },
      });

      return { site, adminUser: { id: adminUser.id, username: adminUser.username, email: adminUser.email, role: adminUser.role } };
    });

    return {
      success: true,
      tenant: result.site,
      adminCredentials: {
        email: data.ownerEmail.toLowerCase(),
        username: result.adminUser.username,
        password: adminPassword,
        role: 'ADMIN',
        loginUrl: 'https://' + data.domain.toLowerCase(),
      },
    };
  }'''
    
    content = content[:start_idx] + new_method + content[end_idx:]
    print("createTenant replaced successfully")
else:
    print(f"Could not find createTenant markers. start={start_idx}, end={end_idx}")

# 4. Add new methods before HELPERS section
helper_marker = "  // ============================================\n  // HELPERS"

new_methods = '''  // ============================================
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

  // ============================================
  // PASSWORD GENERATOR
  // ============================================
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

  // ============================================
  // HELPERS'''

if helper_marker in content:
    content = content.replace(helper_marker, new_methods)
    print("New methods added successfully")
else:
    print("Could not find HELPERS marker")

with open(filepath, "w") as f:
    f.write(content)

print("File saved successfully!")
