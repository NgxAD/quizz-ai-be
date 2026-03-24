import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { QuestionBanksService } from './question-banks.service';
import { CreateQuestionBankDto } from './dtos/create-question-bank.dto';

@Controller('question-banks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuestionBanksController {
  constructor(private bankService: QuestionBanksService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createBank(@Body() createBankDto: CreateQuestionBankDto, @GetUser() user: any) {
    return this.bankService.createBank(createBankDto, user.userId);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getAllBanks(@GetUser() user: any) {
    return this.bankService.findAllByUser(user.userId);
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getBankById(@Param('id') id: string) {
    return this.bankService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateBank(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateQuestionBankDto>,
  ) {
    return this.bankService.updateBank(id, updateData);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteBank(@Param('id') id: string) {
    return this.bankService.deleteBank(id);
  }

  @Post(':id/questions/:questionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async addQuestion(@Param('id') bankId: string, @Param('questionId') questionId: string) {
    return this.bankService.addQuestion(bankId, questionId);
  }

  @Delete(':id/questions/:questionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async removeQuestion(
    @Param('id') bankId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.bankService.removeQuestion(bankId, questionId);
  }
}
