import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.constants.js';
import { byIpAndEmail } from '../../common/rate-limit/rate-limit.trackers.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { toAdminResponse } from './mappers/admin.mapper.js';
import { PasswordResetService } from './password-reset.service.js';
import type { AdminProfile, AuthenticatedAdmin } from './mappers/admin.mapper.js';
import { SessionCookies } from './session-cookies.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly cookies: SessionCookies,
  ) {}

  @Public()
  @Throttle({ default: { ...RATE_LIMITS.login, getTracker: byIpAndEmail } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<AdminProfile> {
    const result = await this.authService.login(dto.email, dto.password);
    this.cookies.set(response, result);
    return toAdminResponse(result.admin);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AdminProfile> {
    const result = await this.authService.refresh(request.cookies?.[REFRESH_COOKIE]);
    this.cookies.set(response, result);
    return toAdminResponse(result.admin);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(request.cookies?.[REFRESH_COOKIE], request.cookies?.[ACCESS_COOKIE]);
    this.cookies.clear(response);
  }

  @Get('me')
  me(@CurrentAdmin() admin: AuthenticatedAdmin): AdminProfile {
    return toAdminResponse(admin);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.authService.changePassword(admin, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Throttle({ default: { ...RATE_LIMITS.forgotPassword, getTracker: byIpAndEmail } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() dto: ForgotPasswordDto): void {
    this.passwordReset.request(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordReset.reset(dto.token, dto.newPassword);
  }
}
