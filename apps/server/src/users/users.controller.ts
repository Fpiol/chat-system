import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    const users = await this.userModel.find().exec();
    return users.map(u => ({
      id: u._id,
      username: u.username,
      email: u.email,
      avatar: u.avatar,
    }));
  }
}

