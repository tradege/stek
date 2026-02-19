import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Authentication required');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      // Verify user exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
        },
      });

      if (!user) {
        throw new WsException('User not found');
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new WsException(`Account is ${user.status.toLowerCase()}`);
      }

      // Attach user to socket data
      client.data.user = user;

      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Invalid token');
    }
  }

  /**
   * Extract token from socket handshake
   * Supports: auth.token, query.token, headers.authorization
   */
  private extractToken(client: Socket): string | null {
    // Try auth object first (recommended)
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Try query parameter
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    // Try authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    return null;
  }
}

/**
 * Helper function to get user from socket
 */
export function getSocketUser(client: Socket) {
  return client.data.user;
}
