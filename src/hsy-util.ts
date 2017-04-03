import {Message, Contact, Room} from "wechaty";
import {HsyGroupEnum} from "./model";
import Global = NodeJS.Global;
import {GROUP_DICT} from "./global";
import { Logger } from "log4ts";

const logger = Logger.getLogger(`main`);

export class HsyUtil {
  public static getNormalizedHsyGroupName(groupName:string):string {
    return "【好室友】" + groupName;
  }
  public static getUserIdFromName = function(name) {
    return 'group-collected-' + name;
  };

  public static isBlacklisted = function(c:Contact) {
    return /#黑名单$/.test(c.remark());
  };

  public static isAdmin = function(c:Contact) {
    return /#管理员$/.test(c.remark());
  };

  public static isHsyGroup = function(topic:string) {
    return HsyUtil.getHsyGroupEnum(topic);
  };

  public static getHsyGroupEnum = function(topic:string):HsyGroupEnum {
    if (!/好室友/.test(topic))
      return HsyGroupEnum.None;
    for (let key in GROUP_DICT) {
      let keyRegEx = new RegExp(HsyUtil.getNormalizedHsyGroupName(key));
      if (keyRegEx.test(topic)) {
        return GROUP_DICT[key];
      }
    }
    return HsyGroupEnum.None;
  };

  public static findRoomByKey = async function(key:string):Promise<Room> {
    let typeRegEx = new RegExp(HsyUtil.getNormalizedHsyGroupName(key));
    return await Room.find({topic: typeRegEx});
  };

  public static kickContactFromRoom =
      async function(contact:Contact, room:Room, force:Boolean = false):Promise<Boolean> {
    if (HsyUtil.shouldNeverRemove(contact)) {
      logger.info(`Contact ${WeChatyApiX.contactToStringLong(contact)} ` +
          `should never be removed, skipping...`);
      return false;
    } else {
      await room.del(contact);
      return true;
    }
  };

  public static shouldNeverRemove = function(contact:Contact) {
    return contact.self() || HsyUtil.isAdmin((contact));
  };

  public static addToBlacklist = async function(contact:Contact) {
    if (HsyUtil.isAdmin(contact)) {
      logger.trace(`试图把管理员加入黑名单，${WeChatyApiX.contactToStringLong(contact)}...`);
    } else {
      logger.trace(`正在把用户加入黑名单，${WeChatyApiX.contactToStringLong(contact)}...`);
      await contact.remark(contact.name().slice(0, 5)/*in case too long of name*/ + '#黑名单');
    }
  };

  public static kickFromAllHsyGroups = async function(contact:Contact) {
    if (HsyUtil.isAdmin(contact)) {
      logger.trace(`试图清理管理员${WeChatyApiX.contactToStringLong(contact)}， 放弃...`);
      return;
    }

    for (let key in GROUP_DICT) {
      let room = await HsyUtil.findRoomByKey(key);
      logger.trace(`正在从${room.topic()}群中踢出该用户...`);
      if(contact.self()) {
        logger.warn(`WARNING WARNING WARINING attempt to delet myeself!`);
      } else await HsyUtil.kickContactFromRoom(contact, room);
      logger.trace(`已从从${room.topic()}群中踢出该用户.`);
    }
  };

  public static removeFriend = function(contact:Contact) {
    // TODO(zzn): implemented
  };

  public static shouldCareAboutMessage = function(message:Message) {
    return !message.self() &&
        (
            WeChatyApiX.isTalkingToMePrivately(message) ||
            HsyUtil.getHsyGroupEnum(message.room().topic()) != HsyGroupEnum.None
        );
  }
}

export class WeChatyApiX {
  // TODO(zzn): add toLongString() of contact
  public static contactToStringLong = function(c:Contact):string {
    return `昵称:${c.name()}, 备注:${c.remark()}, 群昵称: ${WeChatyApiX.getGroupNickNameFromContact(c)}`;
  };

  // TODO(zzn): move to WeChaty API
  public static getGroupNickNameFromContact = function(c:Contact) {
    return c['rawObj']['DisplayName'];
  };

  public static isTalkingToMePrivately = function(m:Message) {
    return m.rawObj['MMIsChatRoom'] == false;
  };
}
