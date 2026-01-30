import { Controller, Post, Body, HttpCode, Get, UseGuards, Req, Query, Res, Patch } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
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
      
      // Redirect to frontend with token and user data
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const token = result.access_token;
      const userData = encodeURIComponent(JSON.stringify({
        _id: result.user._id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        avatar: result.user.avatar,
      }));
      
      res.redirect(`${frontendUrl}/login?token=${token}&user=${userData}`);
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

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, updateProfileDto);
  }
}
