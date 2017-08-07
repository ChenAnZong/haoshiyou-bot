import { Logger, LoggerConfig } from "log4ts";
import {Room, Contact} from "wechaty";
import {WeChatyApiX, HsyUtil} from "../hsy-util";
import {HsyGroupEnum} from "../model";
import * as webdriver from "../../.cache.bak/yarn/npm-@types/selenium-webdriver-2.53.39-15ff93392c339abd39d6d3a04e715faa9a263cf3/index";
import map = webdriver.promise.map;
const logger = Logger.getLogger(`main`);
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
  let groups = await HsyUtil.findAllHsyGroups();
  let mapInviteeIdToRoomList = {};

  inviteeList.forEach((invitee) => {
    mapInviteeIdToRoomList[invitee.id] = [];
    for (let group of groups) {
      mapInviteeIdToRoomList[invitee.id].push(group);
    }
  });
  let flag = false;
  let buffer = `警告，刚刚被这个邀请人（${WeChatyApiX.contactToStringLong(inviter)}）加入群${room.topic()}的用户被加入超过${threshold}个群\n`;
  for (let invitee of inviteeList) {
    if (mapInviteeIdToRoomList[invitee.id].length >= threshold) {
      flag = true;
      buffer += `被邀请人${WeChatyApiX.contactToStringLong(invitee)}\n被加入以下${mapInviteeIdToRoomList[invitee.id].length}个群\n`;
      buffer += `${mapInviteeIdToRoomList[invitee.id].map((room) => `${room.topic()}\n`)}`;
    }
  }
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
想查看入群之前的帖子，点此 http://www.haoshiyou.org/?area=${HsyGroupEnum[areaEnum]}&referrer=hsybot-welcome-msg`;
  await room.say(msg);
};
