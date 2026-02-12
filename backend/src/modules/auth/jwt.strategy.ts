import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { UserStatus } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET") || "stakepro-super-secret-key-change-in-production",
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        displayName: true,
        avatarUrl: true,
        tokenVersion: true,
        siteId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is " + user.status.toLowerCase());
    }

    // Zombie Token Protection: reject tokens from before password change
    if (payload.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException("Token has been revoked. Please login again.");
      }
    }

    return user;
  }
}
