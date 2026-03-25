import { Controller, Post, Body, HttpCode, Get, UseGuards, Req, Query, Res, Patch, BadRequestException, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { RequestPasswordResetDto } from './dtos/request-password-reset.dto';
import { VerifyResetCodeDto } from './dtos/verify-reset-code.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // This endpoint is used by the frontend to redirect to Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    try {
      const result = await this.authService.googleLogin(req.user);
      
      // Generate a temporary session ID to store auth data securely
      const sessionId = await this.authService.createAuthSession(result);
      
      // Redirect to frontend with only session ID (safe to pass in URL)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/callback?sessionId=${sessionId}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  @Post('google')
  @HttpCode(200)
  async googleLoginWithCode(@Body() body: { code: string }) {
    return this.authService.googleLoginWithCode(body.code);
  }

  @Get('session/:sessionId')
  @HttpCode(200)
  async getAuthSession(@Param('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    return this.authService.getAuthSession(sessionId);
  }

  @Post('update-role')
  @UseGuards(AuthGuard('jwt'))
  async updateRole(@Req() req, @Body() body: { role: string }) {
    return this.authService.updateUserRole(req.user.sub, body.role);
  }

  @Post('downgrade-teacher')
  @UseGuards(AuthGuard('jwt'))
  async downgradeTeacher(@Req() req) {
    return this.authService.downgradeTeacher(req.user.sub);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getCurrentUser(@Req() req) {
    return this.authService.getUserById(req.user.sub);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, updateProfileDto);
  }

  @Post('request-password-reset')
  @HttpCode(200)
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestPasswordResetDto.email);
  }

  @Post('verify-reset-code')
  @HttpCode(200)
  async verifyResetCode(@Body() verifyResetCodeDto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(verifyResetCodeDto.email, verifyResetCodeDto.code);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.code,
      resetPasswordDto.password
    );
  }
}
