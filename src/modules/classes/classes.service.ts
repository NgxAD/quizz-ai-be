import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Class, ClassDocument } from '../../schemas/class.schema';
import { CreateClassDto } from './dtos/create-class.dto';
import { UpdateClassDto } from './dtos/update-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
  ) {}

  /**
   * Generate unique class code (6 random digits)
   */
  private generateClassCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create a new class
   */
  async createClass(
    createClassDto: CreateClassDto,
    createdBy: string,
  ): Promise<Class> {
    const classCode = this.generateClassCode();

    const newClass = await this.classModel.create({
      name: createClassDto.name,
      description: createClassDto.description || '',
      code: classCode,
      createdBy,
      members: [],
      studentCount: 0,
      assignedExams: [],
    });

    return newClass.populate('createdBy', '-password');
  }

  /**
   * Get all classes for a teacher
   */
  async getTeacherClasses(createdBy: string): Promise<Class[]> {
    return this.classModel
      .find({ createdBy })
      .populate('createdBy', '-password')
      .populate('members', '-password')
      .sort({ createdAt: -1 });
  }

  /**
   * Get all classes for a student (classes they joined)
   */
  async getStudentClasses(studentId: string): Promise<Class[]> {
    return this.classModel
      .find({ members: studentId })
      .populate('createdBy', '-password')
      .populate('members', '-password')
      .sort({ createdAt: -1 });
  }

  /**
   * Get class by ID
   */
  async getClassById(id: string): Promise<Class> {
    const classDoc = await this.classModel
      .findById(id)
      .populate('createdBy', '-password')
      .populate('members', '-password')
      .populate('assignedExams');

    if (!classDoc) {
      throw new NotFoundException('Lớp không tồn tại');
    }

    return classDoc;
  }

  /**
   * Update class
   */
  async updateClass(
    id: string,
    updateClassDto: UpdateClassDto,
    createdBy: string,
  ): Promise<Class> {
    const classDoc = await this.classModel.findById(id);

    if (!classDoc) {
      throw new NotFoundException('Lớp không tồn tại');
    }

    if (classDoc.createdBy.toString() !== createdBy) {
      throw new BadRequestException('Bạn không có quyền chỉnh sửa lớp này');
    }

    if (updateClassDto.name) {
      classDoc.name = updateClassDto.name;
    }
    if (updateClassDto.description !== undefined) {
      classDoc.description = updateClassDto.description;
    }

    await classDoc.save();
    return classDoc.populate('createdBy', '-password');
  }

  /**
   * Delete class
   */
  async deleteClass(id: string, createdBy: string): Promise<void> {
    const classDoc = await this.classModel.findById(id);

    if (!classDoc) {
      throw new NotFoundException('Lớp không tồn tại');
    }

    if (classDoc.createdBy.toString() !== createdBy) {
      throw new BadRequestException('Bạn không có quyền xóa lớp này');
    }

    await this.classModel.findByIdAndDelete(id);
  }

  /**
   * Get class members
   */
  async getClassMembers(id: string): Promise<any[]> {
    const classDoc = await this.classModel
      .findById(id)
      .populate('members', 'fullName email');

    if (!classDoc) {
      throw new NotFoundException('Lớp không tồn tại');
    }

    return classDoc.members.map((member: any) => ({
      _id: member._id,
      fullName: member.fullName,
      email: member.email,
      joinedAt: member.createdAt,
    }));
  }

  /**
   * Remove member from class
   */
  async removeMember(classId: string, studentId: string): Promise<void> {
    const classDoc = await this.classModel.findById(classId);

    if (!classDoc) {
      throw new NotFoundException('Lớp không tồn tại');
    }

    classDoc.members = classDoc.members.filter(
      (m) => m.toString() !== studentId,
    );
    classDoc.studentCount = classDoc.members.length;

    await classDoc.save();
  }

  /**
   * Join class by code
   */
  async joinClassByCode(code: string, studentId: string): Promise<Class> {
    const classDoc = await this.classModel.findOne({ code });

    if (!classDoc) {
      throw new NotFoundException('Mã lớp không hợp lệ');
    }

    if (classDoc.members.includes(studentId)) {
      throw new BadRequestException('Bạn đã tham gia lớp này rồi');
    }

    classDoc.members.push(studentId);
    classDoc.studentCount = classDoc.members.length;

    await classDoc.save();
    return classDoc.populate('createdBy', '-password');
  }

  /**
   * Assign exam to class
   */
  async assignExamToClass(classId: string, examId: string): Promise<void> {
    const classDoc = await this.classModel.findById(classId);

    if (!classDoc) {
      throw new NotFoundException('Lớp không tồn tại');
    }

    if (!classDoc.assignedExams.includes(examId)) {
      classDoc.assignedExams.push(examId);
      await classDoc.save();
    }
  }
}
