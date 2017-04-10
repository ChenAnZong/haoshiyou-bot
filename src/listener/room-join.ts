import { Logger, LoggerConfig } from "log4ts";
import {Room, Contact} from "wechaty";
import {WeChatyApiX, HsyUtil} from "../hsy-util";
const logger = Logger.getLogger(`main`);

exports = module.exports = async function onRoomJoin(room:Room, inviteeList, inviter) {

  logger.info(`群 ${room.topic()}, ${inviter.name()}邀请${inviteeList.length}个新成员，内容如下`);
  let shouldBlacklistInviter = false;
  let blackListedInviteeList = [];
  inviteeList.forEach((invitee) => {
    logger.info(`被邀请人: ${WeChatyApiX.contactToStringLong(invitee)}.`);
    if (HsyUtil.isHsyBlacklisted(invitee)) {
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
