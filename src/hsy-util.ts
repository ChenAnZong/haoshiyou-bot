import {Message, Contact, Room} from "wechaty";
import {HsyGroupEnum} from "./model";
import Global = NodeJS.Global;
import {GROUP_DICT} from "./global";
import {Logger} from "log4ts";

const logger = Logger.getLogger(`main`);

export class HsyUtil {
  public static getNormalizedHsyGroupName(groupName:string):string {
    return "【好室友】" + groupName;
  }
  public static getHsyUserIdFromName = function(name) {
    return 'group-collected-' + name;
  };

  public static isHsyBlacklisted = async function(c:Contact) {
    if (!c.isReady()) {
      await c.refresh();
    }
    let result = /#黑名单$/.test(c.remark());
    if (result)
      logger.info(`${WeChatyApiX.contactToStringLong(c)}是黑名单用户`);
    return result;
  };

  public static isHsyAdmin = async function(c:Contact) {
    if (!c.isReady()) {
      await c.refresh();
    }
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

  public static findHsyRoomByKey = async function(key:string):Promise<Room> {
    let typeRegEx = new RegExp(HsyUtil.getNormalizedHsyGroupName(key));
    return await Room.find({topic: typeRegEx});
  };

  public static findHsyBigTeamRoom = async function():Promise<Room> {
    return await HsyUtil.findHsyRoomByKey('大军团');
  };

  public static kickContactFromRoom =
      async function(contact:Contact, room:Room):Promise<Boolean> {
    if (!await HsyUtil.shouldNeverRemove(contact)) {
      await room.del(contact);
      return true;
    } else {
      logger.info(`Contact ${WeChatyApiX.contactToStringLong(contact)} ` +
          `should never be removed, skipping...`);
      return false;
    }
  };

  public static shouldNeverRemove = async function(contact:Contact) {
    return contact.self() || await HsyUtil.isHsyAdmin((contact));
  };

  public static addToBlacklist = async function(contact:Contact) {
    if (HsyUtil.isHsyAdmin(contact)) {
      logger.trace(`试图把管理员加入黑名单，${WeChatyApiX.contactToStringLong(contact)}...`);
    } else {
      logger.trace(`正在把用户加入黑名单，${WeChatyApiX.contactToStringLong(contact)}...`);
      await contact.remark(contact.name().slice(0, 5)/*in case too long of name*/ + '#黑名单');
    }
  };

  public static kickFromAllHsyGroups = async function(contact:Contact) {
    if (HsyUtil.isHsyAdmin(contact)) {
      logger.trace(`试图清理管理员${WeChatyApiX.contactToStringLong(contact)}， 放弃...`);
      return;
    }

    for (let key in GROUP_DICT) {
      let room = await HsyUtil.findHsyRoomByKey(key);
      logger.trace(`正在从${room.topic()}群中踢出该用户...`);
      if(contact.self()) {
        logger.warn(`WARNING WARNING WARNING attempt to delete myself!`);
      } else await HsyUtil.kickContactFromRoom(contact, room);
      logger.trace(`已从从${room.topic()}群中踢出该用户.`);
    }
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
  public static contactToStringLong = function(c:Contact):string {
    return `` +
        (StringUtil.isNullOrUndefinedOrEmpty(c.name()) ? `无昵称` : `昵称:"${c.name()}", `) +
        (StringUtil.isNullOrUndefinedOrEmpty(c.remark()) ? `无备注` : `备注:"${c.remark()}", `) +
        (StringUtil.isNullOrUndefinedOrEmpty(
            WeChatyApiX.getGroupNickNameFromContact(c)) ?
            `无群昵称` : `群昵称: "${WeChatyApiX.getGroupNickNameFromContact(c)}"`);
  };

  public static getGroupNickNameFromContact = function(c:Contact) {
    return c['rawObj']['DisplayName'];
  };

  public static isTalkingToMePrivately = function(m:Message) {
    return m.rawObj['MMIsChatRoom'] == false; // consider add m.to().self()
  };
}

export class StringUtil {
  public static isNullOrUndefinedOrEmpty(s:string|null):boolean {
    if (s == null) return true;
    if (typeof s == "undefined") return true;
    if (s == "") return true;
  }
}
