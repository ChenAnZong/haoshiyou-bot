import { Logger, LoggerConfig } from "log4ts";
import {Room, Contact} from "wechaty";
import {WeChatyApiX, HsyUtil} from "../hsy-util";
import {HsyGroupEnum} from "../model";
const logger = Logger.getLogger(`main`);
const magicChar = String.fromCharCode(8197);
exports = module.exports = async function onRoomJoin(
    room:Room, inviteeList:Contact[], inviter:Contact) {
  if (HsyUtil.getHsyGroupEnum(room.topic()) != HsyGroupEnum.None) {
    await maybeRemoveBlacklistInviteeAndInviter(room, inviteeList, inviter);
    await sendWelcomeMessage(room, inviteeList, inviter);
  }
};

let maybeRemoveBlacklistInviteeAndInviter = async function(
    room:Room,  inviteeList:Contact[], inviter:Contact) {
    logger.info(`群 ${room.topic()}, ${inviter.name()}邀请${inviteeList.length}个新成员，内容如下`);
    let shouldBlacklistInviter = false;
    let blackListedInviteeList = [];
    await inviteeList.forEach(async (invitee) => {
      logger.info(`被邀请人: ${WeChatyApiX.contactToStringLong(invitee)}.`);
      if (await HsyUtil.isHsyBlacklisted(invitee)) {
        logger.info(`被邀请人: ${WeChatyApiX.contactToStringLong(invitee)}，是个黑名单成员.`);
        shouldBlacklistInviter = true;
        blackListedInviteeList.push(invitee);
      }
    });

    if (shouldBlacklistInviter) {
      let teamRoom = await HsyUtil.findHsyRoomByKey("大军团");
      await teamRoom.say(`${inviter} 邀请了黑名单用户 ` +
          `${blackListedInviteeList} 进群${room.topic()}, ` +
          `下面开始清理.`);
      await HsyUtil.addToBlacklist(inviter);
      await HsyUtil.kickContactFromRoom(inviter, room);

      blackListedInviteeList.forEach(async (c:Contact) => {
        await HsyUtil.addToBlacklist(c);
        await HsyUtil.kickContactFromRoom(c, room);
      });

      await teamRoom.say(`清理完成！`);
  }
};
let sendWelcomeMessage = async function(room:Room, inviteeList:Contact[], inviter:Contact) {
  let areaEnum = HsyUtil.getHsyGroupEnum(room.topic());
  let msg = `欢迎新群友${inviteeList.map(c=>`@${c.name()}${magicChar}`).join(',')}入群，
想查看入群之前的帖子，点此 http://www.haoshiyou.org/?area=${HsyGroupEnum[areaEnum]}&referrer=hsybot-welcome-msg`;
  await room.say(msg);
};
