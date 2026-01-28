import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subject, SubjectDocument } from '../../schemas/subject.schema';
import { CreateSubjectDto } from './dtos/create-subject.dto';
import { UpdateSubjectDto } from './dtos/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(@InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>) {}

  async create(createSubjectDto: CreateSubjectDto) {
    const existingSubject = await this.subjectModel.findOne({ name: createSubjectDto.name });
    if (existingSubject) {
      throw new BadRequestException('Môn học này đã tồn tại');
    }

    return this.subjectModel.create(createSubjectDto);
  }

  async findAll() {
    return this.subjectModel.find({ isActive: true });
  }

  async findById(id: string) {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Môn học không tồn tại');
    }
    return subject;
  }

  async update(id: string, updateSubjectDto: UpdateSubjectDto) {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Môn học không tồn tại');
    }

    if (updateSubjectDto.name && updateSubjectDto.name !== subject.name) {
      const existingSubject = await this.subjectModel.findOne({ name: updateSubjectDto.name });
      if (existingSubject) {
        throw new BadRequestException('Tên môn học này đã tồn tại');
      }
    }

    return this.subjectModel.findByIdAndUpdate(id, updateSubjectDto, { new: true });
  }

  async delete(id: string) {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Môn học không tồn tại');
    }

    await this.subjectModel.deleteOne({ _id: id });
    return { message: 'Xóa môn học thành công' };
  }

  async toggleStatus(id: string) {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Môn học không tồn tại');
    }

    const updated = await this.subjectModel.findByIdAndUpdate(
      id,
      { isActive: !subject.isActive },
      { new: true },
    );
    return updated;
  }
}
