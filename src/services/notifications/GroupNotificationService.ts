// src/services/notifications/GroupNotificationService.ts
import AppNotificationService, { AppNotification } from './AppNotificationService';
import { GroupChatService } from '../firebase/GroupChatService';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdBy: string;
  createdAt: Date;
  members: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
      avatar?: string;
    };
    role: 'admin' | 'member';
    joinedAt: Date;
  }>;
  updatedAt: Date;
}

export class GroupNotificationService {
  private static instance: GroupNotificationService;
  private appNotificationService: AppNotificationService;

  constructor() {
    this.appNotificationService = AppNotificationService.getInstance();
  }

  static getInstance(): GroupNotificationService {
    if (!GroupNotificationService.instance) {
      GroupNotificationService.instance = new GroupNotificationService();
    }
    return GroupNotificationService.instance;
  }

  // Send group created notification
  async sendGroupCreatedNotification(
    group: Group,
    createdByUserName: string
  ): Promise<void> {
    try {
      console.log('🆕 Sending group created notifications for:', group.name);

      // Send notification to all members except creator
      const memberPromises = group.members
        .filter(member => member.userId !== group.createdBy)
        .map(member => {
          const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
            userId: member.userId,
            type: 'group_created',
            title: '🆕 Added to New Group',
            message: `${createdByUserName} added you to "${group.name}"`,
            data: {
              groupId: group.id,
              groupName: group.name,
              groupAvatar: group.avatar,
              groupAddedBy: createdByUserName,
              navigationType: 'group'
            },
            isRead: false
          };

          return this.appNotificationService.sendNotification(notification);
        });

      await Promise.all(memberPromises);

      // Send system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: group.id,
        userId: 'system',
        userName: 'System',
        message: `Group "${group.name}" was created by ${createdByUserName} on ${new Date().toLocaleDateString()}`,
        type: 'system'
      });

      console.log('✅ Group created notifications sent');
    } catch (error) {
      console.error('❌ Failed to send group created notifications:', error);
      throw error;
    }
  }

  // Send group member added notification
  async sendGroupMemberAddedNotification(
    group: Group,
    newMember: Group['members'][0],
    addedByUserId: string,
    addedByUserName: string
  ): Promise<void> {
    try {
      console.log('👥 Sending group member added notifications');

      // Notification to the new member
      const newMemberNotification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: newMember.userId,
        type: 'group_member_added',
        title: '👥 Added to Group',
        message: `${addedByUserName} added you to "${group.name}"`,
        data: {
          groupId: group.id,
          groupName: group.name,
          groupAvatar: group.avatar,
          groupAddedBy: addedByUserName,
          navigationType: 'group'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(newMemberNotification);

      // Notifications to existing members (except the one who added)
      const existingMemberPromises = group.members
        .filter(member => member.userId !== addedByUserId && member.userId !== newMember.userId)
        .map(member => {
          const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
            userId: member.userId,
            type: 'group_member_added',
            title: '👥 New Group Member',
            message: `${addedByUserName} added ${newMember.userData.fullName} to "${group.name}"`,
            data: {
              groupId: group.id,
              groupName: group.name,
              groupAvatar: group.avatar,
              groupAddedBy: addedByUserName,
              navigationType: 'groupMembers'
            },
            isRead: false
          };

          return this.appNotificationService.sendNotification(notification);
        });

      await Promise.all(existingMemberPromises);

      // Send system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: group.id,
        userId: 'system',
        userName: 'System',
        message: `${newMember.userData.fullName} was added to the group by ${addedByUserName}`,
        type: 'system'
      });

      console.log('✅ Group member added notifications sent');
    } catch (error) {
      console.error('❌ Failed to send group member added notifications:', error);
      throw error;
    }
  }

  // Send admin changed notification
  async sendAdminChangedNotification(
    group: Group,
    targetMember: Group['members'][0],
    changedByUserId: string,
    changedByUserName: string,
    isPromoted: boolean
  ): Promise<void> {
    try {
      console.log('👑 Sending admin changed notifications');

      const action = isPromoted ? 'promoted to admin' : 'removed as admin';
      const emoji = isPromoted ? '👑' : '👤';

      // Notification to the target member
      const targetNotification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: targetMember.userId,
        type: 'group_admin_changed',
        title: `${emoji} Admin Role ${isPromoted ? 'Granted' : 'Removed'}`,
        message: `${changedByUserName} ${action} in "${group.name}"`,
        data: {
          groupId: group.id,
          groupName: group.name,
          groupAvatar: group.avatar,
          adminChangedBy: changedByUserName,
          isPromoted,
          navigationType: 'groupMembers'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(targetNotification);

      // Notifications to other members
      const otherMemberPromises = group.members
        .filter(member => member.userId !== changedByUserId && member.userId !== targetMember.userId)
        .map(member => {
          const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
            userId: member.userId,
            type: 'group_admin_changed',
            title: `${emoji} Admin Role Changed`,
            message: `${changedByUserName} ${action} ${targetMember.userData.fullName} in "${group.name}"`,
            data: {
              groupId: group.id,
              groupName: group.name,
              groupAvatar: group.avatar,
              adminChangedBy: changedByUserName,
              isPromoted,
              navigationType: 'groupMembers'
            },
            isRead: false
          };

          return this.appNotificationService.sendNotification(notification);
        });

      await Promise.all(otherMemberPromises);

      // Send system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: group.id,
        userId: 'system',
        userName: 'System',
        message: `${targetMember.userData.fullName} was ${action} by ${changedByUserName}`,
        type: 'system'
      });

      console.log('✅ Admin changed notifications sent');
    } catch (error) {
      console.error('❌ Failed to send admin changed notifications:', error);
      throw error;
    }
  }

  // Send member removed notification
  async sendMemberRemovedNotification(
    group: Group,
    removedMember: Group['members'][0],
    removedByUserId: string,
    removedByUserName: string
  ): Promise<void> {
    try {
      console.log('🚫 Sending member removed notifications');

      // Notification to the removed member
      const removedMemberNotification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: removedMember.userId,
        type: 'group_member_removed',
        title: '🚫 Removed from Group',
        message: `${removedByUserName} removed you from "${group.name}"`,
        data: {
          groupId: group.id,
          groupName: group.name,
          groupAvatar: group.avatar,
          removedBy: removedByUserName,
          navigationType: 'friends'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(removedMemberNotification);

      // Notifications to remaining members (except the one who removed)
      const remainingMemberPromises = group.members
        .filter(member => member.userId !== removedByUserId && member.userId !== removedMember.userId)
        .map(member => {
          const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
            userId: member.userId,
            type: 'group_member_removed',
            title: '🚫 Member Removed',
            message: `${removedByUserName} removed ${removedMember.userData.fullName} from "${group.name}"`,
            data: {
              groupId: group.id,
              groupName: group.name,
              groupAvatar: group.avatar,
              removedBy: removedByUserName,
              navigationType: 'groupMembers'
            },
            isRead: false
          };

          return this.appNotificationService.sendNotification(notification);
        });

      await Promise.all(remainingMemberPromises);

      // Send system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: group.id,
        userId: 'system',
        userName: 'System',
        message: `${removedMember.userData.fullName} was removed from the group by ${removedByUserName}`,
        type: 'system'
      });

      console.log('✅ Member removed notifications sent');
    } catch (error) {
      console.error('❌ Failed to send member removed notifications:', error);
      throw error;
    }
  }

  // Send QR code invite accepted notification
  async sendQRInviteAcceptedNotification(
    group: Group,
    newMember: Group['members'][0],
    inviteCode: string
  ): Promise<void> {
    try {
      console.log('📱 Sending QR invite accepted notifications');

      // Notification to new member
      const newMemberNotification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: newMember.userId,
        type: 'group_member_added',
        title: '🎉 Joined Group via QR',
        message: `You successfully joined "${group.name}" via QR code`,
        data: {
          groupId: group.id,
          groupName: group.name,
          groupAvatar: group.avatar,
          joinMethod: 'qr',
          navigationType: 'group'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(newMemberNotification);

      // Notifications to all existing members
      const existingMemberPromises = group.members
        .filter(member => member.userId !== newMember.userId)
        .map(member => {
          const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
            userId: member.userId,
            type: 'group_member_added',
            title: '📱 Member Joined via QR',
            message: `${newMember.userData.fullName} joined "${group.name}" via QR code`,
            data: {
              groupId: group.id,
              groupName: group.name,
              groupAvatar: group.avatar,
              joinMethod: 'qr',
              navigationType: 'groupMembers'
            },
            isRead: false
          };

          return this.appNotificationService.sendNotification(notification);
        });

      await Promise.all(existingMemberPromises);

      // Send system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: group.id,
        userId: 'system',
        userName: 'System',
        message: `${newMember.userData.fullName} joined the group via QR code`,
        type: 'system'
      });

      console.log('✅ QR invite accepted notifications sent');
    } catch (error) {
      console.error('❌ Failed to send QR invite accepted notifications:', error);
      throw error;
    }
  }

  // Get group data helper
  async getGroupData(groupId: string): Promise<Group | null> {
    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        return null;
      }

      return {
        id: groupDoc.id,
        ...groupDoc.data(),
        createdAt: groupDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: groupDoc.data().updatedAt?.toDate() || new Date(),
        members: groupDoc.data().members?.map((member: any) => ({
          ...member,
          joinedAt: member.joinedAt?.toDate() || new Date()
        })) || []
      } as Group;
    } catch (error) {
      console.error('❌ Failed to get group data:', error);
      return null;
    }
  }
}

export default GroupNotificationService;
