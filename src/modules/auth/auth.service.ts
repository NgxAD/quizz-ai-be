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
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName, role } = registerDto;

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userModel.create({
      email,
      password: hashedPassword,
      fullName,
      role: role || 'STUDENT',
    });

    const { password: _, ...userWithoutPassword } = user.toObject();
    return {
      message: 'Đăng ký thành công',
      user: userWithoutPassword,
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

    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = user.toObject();
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
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    await this.userModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = user.toObject();
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

    const userRole = role.toLowerCase() as any;
    
    // Prepare update data
    const updateData: any = { role: userRole };
    
    // Only update isTeacherApproved if upgrading to teacher
    // Otherwise keep the current value to allow switching between roles
    if (userRole === 'teacher') {
      updateData.isTeacherApproved = true;
    }
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = user.toObject();

    return {
      message: 'Cập nhật role thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async downgradeTeacher(userId: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { 
        role: 'student',
        isTeacherApproved: false
      },
      { new: true }
    );

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = user.toObject();

    return {
      message: 'Bỏ quyền giáo viên thành công',
      user: userWithoutPassword,
      access_token,
    };
  }

  async updateProfile(userId: string, updateProfileDto: any) {
    const updateData: any = {};

    if (updateProfileDto.fullName) updateData.fullName = updateProfileDto.fullName;
    if (updateProfileDto.phoneNumber) updateData.phoneNumber = updateProfileDto.phoneNumber;
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
}