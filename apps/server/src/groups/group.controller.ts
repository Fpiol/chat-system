import { Controller, Post, Get, Body, UseGuards, Req, Param } from '@nestjs/common';
import { GroupService } from './group.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    username: string;
  };
}

@Controller('groups')
export class GroupController {
  constructor(private groupService: GroupService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createGroup(@Req() req: RequestWithUser, @Body() body: { name: string; members: string[] }) {
    return this.groupService.createGroup(body.name, req.user.userId, body.members);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserGroups(@Req() req: RequestWithUser) {
    return this.groupService.getUserGroups(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  async getGroupMembers(@Param('id') id: string) {
    return this.groupService.getGroupById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mute')
  async muteMember(@Req() req: RequestWithUser, @Param('id') id: string, @Body('memberId') memberId: string) {
    return this.groupService.muteMember(id, req.user.userId, memberId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/unmute')
  async unmuteMember(@Req() req: RequestWithUser, @Param('id') id: string, @Body('memberId') memberId: string) {
    return this.groupService.unmuteMember(id, req.user.userId, memberId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/dissolve')
  async dissolveGroup(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.groupService.dissolveGroup(id, req.user.userId);
  }
}

