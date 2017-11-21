import { Logger, LoggerConfig } from "log4ts";
import {Room, Contact} from "wechaty";

import {WeChatyApiX, HsyUtil} from "../hsy-util";
import {HsyGroupEnum} from "../model";

const logger = Logger.getLogger(`room-join`);
const magicChar = String.fromCharCode(8197);

exports = module.exports = async function onRoomJoin(
    room:Room, inviteeList:Contact[], inviter:Contact) {
  if (HsyUtil.getHsyGroupEnum(room.topic()) != HsyGroupEnum.None) {
    await maybeRemoveBlacklistInviteeAndInviter(room, inviteeList, inviter);
    await maybeWarnInviteeJoinedTooManyGroups(room, inviteeList, inviter);
    await sendWelcomeMessage(room, inviteeList, inviter);
  }
};

let maybeWarnInviteeJoinedTooManyGroups = async function(room:Room,  inviteeList:Contact[], inviter:Contact) {
  let threshold = 2;
  let allGroups = await HsyUtil.findAllRentalHsyGroups();
  let joiningGroup = await HsyUtil.getHsyGroupEnum(room.topic());
  let mapInviteeIdToRoomList = {};

  inviteeList.forEach((invitee:Contact) => {
    mapInviteeIdToRoomList[invitee.id] = []; // create a RoomList for each invitee, empty
    for (let group of allGroups) {
      if (group.has(invitee) || room.id == group.id) {
        mapInviteeIdToRoomList[invitee.id].push(group);
        logger.debug(`Invitee: ${WeChatyApiX.contactToStringLong(invitee)} is in group ${group.topic()}
        group = ${group.topic()}, group.has(invitee) = ${group.has(invitee)}
        joiningGroup = ${joiningGroup}, room.topic() = ${room.topic()}
        joiningGroup == HsyUtil.getHsyGroupEnum(room.topic()) = ${joiningGroup == HsyUtil.getHsyGroupEnum(room.topic())}
        invitee in the memberList = ${group.memberList().filter(c=>c.id ==invitee.id).join(',')}
        `);
      } else {
        logger.debug(`Invitee: ${WeChatyApiX.contactToStringLong(invitee)} is NOT in group ${group.topic()}`);
      }
    }
  });
  let flag = false;
  let buffer = `警告，有用户被加入超过${threshold}个群
邀请人：${WeChatyApiX.contactToStringLong(inviter)}
加入房间：${room.topic()}`;
  for (let invitee of inviteeList) {
    if (mapInviteeIdToRoomList[invitee.id].length >= threshold) {
      flag = true;
      buffer += `
被邀请人：${WeChatyApiX.contactToStringLong(invitee)}
被加入以下${mapInviteeIdToRoomList[invitee.id].length}个群：
`;
      buffer += mapInviteeIdToRoomList[invitee.id].map((room) => `  ${room.topic()}`).join('\n');
    }
  }
  buffer += `
回复
- "踢 [@id]": 会把所有租房群里面的id为[@id]的群友踢出去并在群内警告
- "加黑 [@id]": 会把所有租房群里面的[@id]群友踢出去、加黑名单并在群内警告
  `;
  if (flag) {
    let bigTeam = await HsyUtil.findHsyBigTeamRoom();
    bigTeam.say(buffer);
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
想查看入群之前的帖子，点此 http://www.haoshiyou.org/?area=${HsyGroupEnum[areaEnum]}&referrer=hsybot-welcome-msg&utm_source=haoshiyou-bot&utm_campaign=view_group_tap`;
  await room.say(msg);
};
