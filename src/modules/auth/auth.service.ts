import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../schemas/user.schema';
import { UserRole } from '../../common/enums/role.enum';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { MailerService } from './mailer.service';
import { v4 as uuidv4 } from 'uuid';

interface AuthSession {
  data: {
    message: string;
    user: any;
    access_token: string;
  };
  createdAt: number;
}

@Injectable()
export class AuthService {
  private authSessions = new Map<string, AuthSession>();
  private readonly SESSION_EXPIRES_IN = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {
    // Clean up expired sessions every 30 seconds
    setInterval(() => {
      this.cleanExpiredSessions();
    }, 30000);
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.authSessions.entries()) {
      if (now - session.createdAt > this.SESSION_EXPIRES_IN) {
        this.authSessions.delete(sessionId);
      }
    }
  }

  async createAuthSession(authData: any): Promise<string> {
    const sessionId = uuidv4();
    this.authSessions.set(sessionId, {
      data: authData,
      createdAt: Date.now(),
    });
    console.log('Created auth session:', sessionId);
    return sessionId;
  }

  async getAuthSession(sessionId: string): Promise<any> {
    console.log('Getting auth session:', sessionId);
    console.log('Available sessions:', Array.from(this.authSessions.keys()));
    
    const session = this.authSessions.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session không hợp lệ hoặc đã hết hạn');
    }

    // Check if session is expired
    if (Date.now() - session.createdAt > this.SESSION_EXPIRES_IN) {
      this.authSessions.delete(sessionId);
      throw new UnauthorizedException('Session đã hết hạn');
    }

    // Delete session after retrieval (one-time use)
    this.authSessions.delete(sessionId);
    console.log('Session retrieved and deleted:', sessionId);
    return session.data;
  }

  async register(registerDto: RegisterDto) {
    const { email, password, fullName, role } = registerDto;

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Default role is student (as array)
    const userRoles = [UserRole.STUDENT];

    const user = await this.userModel.create({
      email,
      password: hashedPassword,
      fullName,
      roles: userRoles,
    });

    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = user.toObject();
    return {
      message: 'Đăng ký thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    await this.userModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    console.log('Login - user from DB:', {
      email: user.email,
      roles: user.roles,
    });

    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    const access_token = this.jwtService.sign(payload);

    const userObj = user.toObject();
    console.log('Login - user.toObject():', {
      roles: userObj.roles,
    });

    const { password: _, ...userWithoutPassword } = userObj;
    return {
      message: 'Đăng nhập thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async validateUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return user;
  }

  async googleLogin(profile: any) {
    const { googleId, email, fullName } = profile;

    let user = await this.userModel.findOne({ googleId });

    if (!user) {
      user = await this.userModel.create({
        googleId,
        googleEmail: email,
        email,
        fullName,
        roles: [UserRole.STUDENT],
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    await this.userModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    const access_token = this.jwtService.sign(payload);

    const userObj = user.toObject();
    console.log('Google login - user object:', userObj);
    console.log('Google login - roles:', userObj.roles);

    const { password: _, ...userWithoutPassword } = userObj;
    return {
      message: 'Đăng nhập bằng Google thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async googleLoginWithCode(code: string) {
    // This method would exchange the authorization code for tokens
    // and retrieve user info from Google. For now, this is a placeholder
    // The actual implementation requires making calls to Google's OAuth endpoints
    throw new Error('Method not implemented');
  }

  async updateUserRole(userId: string, role: string) {
    if (!['student', 'teacher', 'admin'].includes(role)) {
      throw new BadRequestException('Role không hợp lệ');
    }

    const newRole = role.toLowerCase() as UserRole;
    
    // Get current user
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    // Add role if not already present
    if (!user.roles.includes(newRole)) {
      user.roles.push(newRole);
    }

    // Update isTeacherApproved if adding teacher role
    const updateData: any = { roles: user.roles };
    if (newRole === UserRole.TEACHER && !user.roles.includes(UserRole.TEACHER)) {
      updateData.isTeacherApproved = true;
    }
    
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!updatedUser) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const payload = {
      sub: updatedUser._id,
      email: updatedUser.email,
      roles: updatedUser.roles,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = updatedUser.toObject();

    return {
      message: 'Cập nhật role thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async downgradeTeacher(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    // Remove teacher role from roles array
    user.roles = user.roles.filter(r => r !== UserRole.TEACHER);

    // Ensure user still has at least student role
    if (user.roles.length === 0) {
      user.roles = [UserRole.STUDENT];
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { 
        roles: user.roles,
        isTeacherApproved: false
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const payload = {
      sub: updatedUser._id,
      email: updatedUser.email,
      roles: updatedUser.roles,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = updatedUser.toObject();

    return {
      message: 'Bỏ quyền giáo viên thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async updateProfile(userId: string, updateProfileDto: any) {
    const updateData: any = {};

    if (updateProfileDto.fullName) updateData.fullName = updateProfileDto.fullName;
    if (updateProfileDto.avatar) updateData.avatar = updateProfileDto.avatar;
    if (updateProfileDto.dateOfBirth) updateData.dateOfBirth = updateProfileDto.dateOfBirth;
    if (updateProfileDto.gender) updateData.gender = updateProfileDto.gender;

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const { password: _, ...userWithoutPassword } = user.toObject();

    return {
      message: 'Cập nhật hồ sơ thành công',
      user: userWithoutPassword,
    };
  }

  async getUserById(userId: string) {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    
    return {
      message: 'Lấy thông tin người dùng thành công',
      user: userWithoutPassword,
    };
  }

  // Generate a random 6-digit code
  private generateResetCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async requestPasswordReset(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      // Don't reveal if email exists for security reasons
      throw new BadRequestException('Nếu email này tồn tại trong hệ thống, bạn sẽ nhận được mã xác minh');
    }

    // Generate 6-digit code
    const resetCode = this.generateResetCode();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Save reset code to database
    await this.userModel.updateOne(
      { _id: user._id },
      { resetCode, resetCodeExpiry }
    );

    // Send email with reset code
    const emailSent = await this.mailerService.sendPasswordResetCode(email, resetCode);
    
    if (!emailSent) {
      console.warn(`Failed to send password reset email to ${email}, but code was saved to DB`);
    }
    
    return {
      message: 'Nếu email này tồn tại trong hệ thống, bạn sẽ nhận được mã xác minh',
    };
  }

  async verifyResetCode(email: string, code: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Email không tồn tại');
    }

    if (!user.resetCode || !user.resetCodeExpiry) {
      throw new BadRequestException('Không có yêu cầu đặt lại mật khẩu nào. Vui lòng yêu cầu lại.');
    }

    // Check if code is expired
    if (new Date() > user.resetCodeExpiry) {
      // Clear expired code
      await this.userModel.updateOne(
        { _id: user._id },
        { resetCode: null, resetCodeExpiry: null }
      );
      throw new BadRequestException('Mã xác minh đã hết hạn. Vui lòng yêu cầu lại.');
    }

    // Check if code matches
    if (user.resetCode !== code) {
      throw new UnauthorizedException('Mã xác minh không đúng');
    }

    return {
      message: 'Mã xác minh hợp lệ',
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Email không tồn tại');
    }

    if (!user.resetCode || !user.resetCodeExpiry) {
      throw new BadRequestException('Không có yêu cầu đặt lại mật khẩu nào. Vui lòng yêu cầu lại.');
    }

    // Check if code is expired
    if (new Date() > user.resetCodeExpiry) {
      // Clear expired code
      await this.userModel.updateOne(
        { _id: user._id },
        { resetCode: null, resetCodeExpiry: null }
      );
      throw new BadRequestException('Mã xác minh đã hết hạn. Vui lòng yêu cầu lại.');
    }

    // Check if code matches
    if (user.resetCode !== code) {
      throw new UnauthorizedException('Mã xác minh không đúng');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset code
    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpiry: null,
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const { password: _, ...userWithoutPassword } = updatedUser.toObject();

    return {
      message: 'Mật khẩu đã được đặt lại thành công',
      user: userWithoutPassword,
    };
  }
}