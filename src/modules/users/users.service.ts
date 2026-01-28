import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserRole } from '../../common/enums/role.enum';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(role?: UserRole) {
    const query = role ? { role } : {};
    const users = await this.userModel.find(query).select('-password');
    return users;
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).select('-password');
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).select('-password');
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userModel.findOne({ email: updateUserDto.email });
      if (existingUser) {
        throw new BadRequestException('Email đã được sử dụng');
      }
    }

    const updated = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
      new: true,
    });
    if (!updated) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    const { password: _, ...result } = updated.toObject();
    return result;
  }

  async changePassword(id: string, oldPassword: string, newPassword: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Mật khẩu cũ không đúng');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.updateOne({ _id: id }, { password: hashedPassword });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async toggleUserStatus(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const updated = await this.userModel.findByIdAndUpdate(
      id,
      { isActive: !user.isActive },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    const { password: _, ...result } = updated.toObject();
    return result;
  }

  async updateUserRole(id: string, role: UserRole) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const updated = await this.userModel.findByIdAndUpdate(id, { role }, { new: true });
    if (!updated) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    const { password: _, ...result } = updated.toObject();
    return result;
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    await this.userModel.deleteOne({ _id: id });
    return { message: 'Xóa người dùng thành công' };
  }

  async getStats() {
    const totalUsers = await this.userModel.countDocuments();
    const adminCount = await this.userModel.countDocuments({ role: UserRole.ADMIN });
    const teacherCount = await this.userModel.countDocuments({ role: UserRole.TEACHER });
    const studentCount = await this.userModel.countDocuments({ role: UserRole.STUDENT });
    const activeUsers = await this.userModel.countDocuments({ isActive: true });

    return {
      totalUsers,
      adminCount,
      teacherCount,
      studentCount,
      activeUsers,
    };
  }
}
