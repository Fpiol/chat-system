import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from '../schemas/group.schema';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  async createGroup(name: string, adminId: string, memberIds: string[]): Promise<Group> {
    const members = Array.from(new Set([adminId, ...memberIds])).map(id => new Types.ObjectId(id));
    const group = new this.groupModel({
      name,
      admin: new Types.ObjectId(adminId),
      members,
    });
    return group.save();
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    return this.groupModel.find({ members: new Types.ObjectId(userId) }).exec();
  }

  async getGroupById(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId).populate('members', 'username email avatar').exec();
    if (!group) throw new NotFoundException('未找到群组');
    return group;
  }

  async muteMember(groupId: string, adminId: string, memberId: string): Promise<Group> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('未找到群组');
    if (group.admin.toString() !== adminId) throw new ForbiddenException('只有管理员可以禁言成员');
    
    if (!group.mutedMembers.map(id => id.toString()).includes(memberId)) {
      group.mutedMembers.push(new Types.ObjectId(memberId));
      await group.save();
    }
    return group;
  }

  async unmuteMember(groupId: string, adminId: string, memberId: string): Promise<Group> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('未找到群组');
    if (group.admin.toString() !== adminId) throw new ForbiddenException('只有管理员可以解除禁言');
    
    group.mutedMembers = group.mutedMembers.filter(id => id.toString() !== memberId);
    await group.save();
    return group;
  }

  async dissolveGroup(groupId: string, adminId: string): Promise<void> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('未找到群组');
    if (group.admin.toString() !== adminId) throw new ForbiddenException('只有管理员可以解散群组');
    await this.groupModel.findByIdAndDelete(groupId);
  }
}

