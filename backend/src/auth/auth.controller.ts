import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AllowPending, Public } from './auth.types';

function clientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first || request.ip || 'unknown').trim();
}

@AllowPending()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { username?: string; password?: string }, @Req() request: Request) {
    return this.auth.login(String(body?.username ?? ''), String(body?.password ?? ''), clientIp(request));
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.auth.me(request.authUser!);
  }

  @Public()
  @Get('convite/:codigo')
  convite(@Param('codigo') codigo: string) {
    return this.auth.checkConvite(codigo);
  }

  @Public()
  @Post('register-convite')
  registerConvite(
    @Body() body: { codigo?: string; username?: string; name?: string; password?: string },
    @Req() request: Request,
  ) {
    return this.auth.registerWithConvite(body ?? {}, clientIp(request));
  }
}
