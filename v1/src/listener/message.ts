import {Room, Contact, Message, MsgType} from "wechaty";
import { createWriteStream }  from 'fs';
import { Logger, LoggerConfig } from "log4ts";

import {HsyBotLogger} from "../datastore";
import {LoopbackQuerier} from "../loopback-querier";
import {HsyUser} from "../../loopbacksdk/models/HsyUser";
import {HsyUtil, WeChatyApiX} from "../hsy-util";
import {HsyGroupEnum} from "../model";

const cloudinary = require('cloudinary');
let logger = Logger.getLogger(`message`);
const newComerSize = 200;
const groupDownSizeTarget = 465;
const groupDownSizeTriggerThreshold = 480;

let MEMORY_memberIdToMemberMap = {};
let MEMORY_allGroups:Room[] = [];
import {
  hsyGroupClearMsg, hsyCannotUnderstandMsg, hysAlreadyAddedMsg,
  hsyGroupNickNameMsg, greetingsMsg, GLOBAL_blackListCandidates,
  getStringFromHsyGroupEnum, ALL_HSY_GROUP_ENUMS, hsyReferMsg, ALL_RENTAL_HSY_GROUP_ENUMS
} from "../global";

if (process.env.CLOUDINARY_SECRET !== undefined && process.env.CLOUDINARY_SECRET.length > 0) {
  cloudinary.config({
    cloud_name: 'xinbenlv',
    api_key: '999284541119412',
    api_secret: process.env.CLOUDINARY_SECRET
  });

} else {
  console.error('Need to specify cloudinary secret by export CLOUDINARY_SECRET="some_secret" .');
  process.exit();
}

exports = module.exports = async function onMessage(m:Message) {
  try {
    logger.trace(`Received msg type: ${m.type()}`);
    HsyBotLogger.logRawChatMsg(m).then(() => {/* does nothing, not waiting*/
    });
    if (!HsyUtil.shouldCareAboutMessage(m)) {
      return;
    }
    if (await HsyUtil.isHsyAdmin(m.from())) {
      logger.info(`A message from Admin`);
    } else if (await HsyUtil.isHsyBlacklisted(m.from())) {
      logger.info(`A message from Blacklisted`);
    } else {
      logger.debug(`A message from normal contact`);
    }

    await maybeBlacklistUser(m) || // if true stops further processing
    await maybeAdminCommand(m) || // if true stops further processing
    await maybeAddToHsyGroups(m) || // if true stops further processing
    await maybeExtractPostingMessage(m);
  } catch (e) {
    logger.warn(e);
  }
};

let findMemberFromGroup = function(room:Room, regExp:RegExp):Array<Contact> {
  return room.memberList().filter(c => {
    return regExp.test(c.name()) || regExp.test(c.alias())
        || regExp.test(WeChatyApiX.getGroupNickNameFromContact(c));
  });
};

let savePic = async function(filename:string, picStream:NodeJS.ReadableStream):Promise<string> {
  logger.trace('IMAGE local filename: ' + filename);
  const fileStream = createWriteStream(filename);
  let stream = await picStream;
  // TODO(xinbenlv): this might cause the error of following
  //   unhandledRejection: Error: not a media message [object Promise]
  return new Promise<string>( /* executor */ function(resolve, reject) {
    stream.pipe(fileStream)
        .on('close', () => {
          logger.trace('finish readyStream()');
          cloudinary.v2.uploader.upload(filename, {
            transformation: [
              {quality:`auto:eco`, crop:`limit`, width: `1080`, height: `4000`}
            ],
            format: 'jpg'
          }, function(error, result) {
            if (error) {
              logger.warn(`error = ${JSON.stringify(error)}`);
              logger.warn(`There is an error in saveMediaFile upload of cloudinary`);
              reject(error);
            } else {
              logger.trace(`Uploaded an image: ${JSON.stringify(result)}, size = ${result.bytes}`);
              let id = result.public_id;
              resolve(result.public_id);
            }
          });
        });
  }).then(publicId => {
    logger.trace(`The PublicId result is ${publicId}`);
    return publicId;
  });
};
let saveImgFileFromMsg = async function(message: Message):Promise<any> {
  const filename = 'tmp/img/' + message.filename();
  return await savePic(filename, await message.readyStream());
};

/**
 * If admin mentioned a member in the 好室友 group and says "无关", then it's a warning
 * to that user. The bot will do the following
 *  1. it will thank the admin and repeat the warning message from the admin
 *  2. it will ask the admin whether the user needs to be blacklisted TODO(zzn):
 * @param m
 * @returns {Promise<boolean>} true if the message is processed
 *   (and should not be processed anymore)
 */
let maybeBlacklistUser = async function(m: Message):Promise<Boolean> {
  if (! await HsyUtil.isHsyAdmin(m.from())) {
    return false; // Not an admin
  }
  let admin = m.from();
  if(WeChatyApiX.isTalkingToMePrivately(m)
      && /加黑名单/.test(m.content())) {
    // find the last one being marked blacklist by this admin
    let blackListObj = GLOBAL_blackListCandidates[admin.alias()];

    // not able to find a blacklist candidate.
    if (blackListObj === undefined || blackListObj === null) return false;
    let timeLapsedInSeconds = (Date.now() - blackListObj.time) / 1000;
    if (blackListObj !== null && blackListObj !== undefined) {
      if ( timeLapsedInSeconds>  60 * 5) {
        if (process.env.FULL_FEATURE) await admin.say(`从刚才群内警告到现在确认加黑名单已经过了` +
            `${(timeLapsedInSeconds)/60}分钟，太久了，请重新警告`);
        delete GLOBAL_blackListCandidates[m.from().alias()];
      } else {
        let indexOfCandidate = m.content().slice(4); //"加黑名单1"取编号
        let contactToBlacklist:Contact = blackListObj.candidates[indexOfCandidate];

        if (process.env.FULL_FEATURE) await admin.say(`正在把用户加入黑名单，` +
            `${WeChatyApiX.contactToStringLong(contactToBlacklist)}...`);
        await HsyUtil.addToBlacklist(contactToBlacklist);

        let teamRoom = await HsyUtil.findHsyBigTeamRoom();
        if (process.env.FULL_FEATURE) await teamRoom.say(`应管理员${admin}的要求，` +
            `正在踢出用户${WeChatyApiX.contactToStringLong(contactToBlacklist)}...`);
        await HsyUtil.kickFromAllHsyGroups(contactToBlacklist);
        if (process.env.FULL_FEATURE) await teamRoom.say(`已完成`);
        if (process.env.FULL_FEATURE) await admin.say(`搞定!`);
      }
    }
    return true;
  } else if (m.room() !== null &&
      /好室友/.test(m.room().topic()) &&
      /无关|修改群昵称/.test(m.content()) &&
      /^@/.test(m.content())) {
    let mentionName = m.content().slice(1)/*ignoring@*/
        .replace(" "/*Space Char in Chinese*/, " ").split(" ")[0];
    logger.debug(`寻找mentionName = ${mentionName}`);
    let foundUsers = findMemberFromGroup(m.room(), new RegExp(mentionName));
    foundUsers = await foundUsers.filter(async c=> {
      if (c.self()) {
        logger.trace(`Ignoring SELF ${WeChatyApiX.contactToStringLong(c)}`);
        return false;
      } else if (await HsyUtil.isHsyAdmin(c)) {
        logger.trace(`Ignoring ADMIN ${WeChatyApiX.contactToStringLong(c)}`);
        return false;
      }
      return true;
    });
    if (foundUsers.length > 0) {
      logger.info(`Found ${foundUsers.length} user(s) being warned against: ${foundUsers}.`);
      if (foundUsers.length > 0) {

        logger.info(`管理员"${m.from().name()}"对用户 ${mentionName} 发出警告`);

        // Repeat the warning from the admin
        if (process.env.FULL_FEATURE) await m.room().say(`感谢管理员@${m.from().name()}\n\n${m.content()}`);

        let buffer = `管理员 ${m.from().name()}，你好，你刚才在${m.room().topic()}这个群` +
            `里警告了用户@${mentionName}，符合这个名称的群内的用户有：\n`;
        for (let i = 0; i < foundUsers.length; i++) {
          let candidate = foundUsers[i];
          buffer += `${i}. 昵称:${candidate.name()}, 备注:${candidate.alias()}, ` +
              `群昵称: ${WeChatyApiX.getGroupNickNameFromContact(candidate)} \n`;
        }
        buffer += `请问要不要把这个用户加黑名单？五分钟内回复 "加黑名单[数字编号]"\n`;
        buffer += `例如 "加黑名单0"，将会把${foundUsers[1]} ` +
            `加入黑名单:${WeChatyApiX.contactToStringLong(foundUsers[0])}`;
        if (process.env.FULL_FEATURE)  await m.from().say(buffer);
        GLOBAL_blackListCandidates[m.from().alias()] = {
          time: Date.now(),
          candidates: foundUsers
        };
      }
    } else {
      logger.warn(`Didn't found the user being warned against: ${mentionName}.`);
      logger.warn(`Full Member List of Group ${m.room().topic()}:`);
      logger.warn(`${m.room().memberList()}:`);
      if (process.env.FULL_FEATURE) await admin.say(`管理员您好，您刚才在"${m.room().topic()}"群里要求踢出的用户"${mentionName}" `+
          `我们没有找到，请在确认该用户仍然在该群里，并且请在同一个群尝试at他的昵称而不是群昵称。`);
    }
    return true;
  }
  return false;
};

/**
 * @returns {Promise<boolean>} true if the message is processed (and should not be processed anymore)
 */
let maybeExtractPostingMessage = async function(m:Message):Promise<Boolean> {
  if (WeChatyApiX.isTalkingToMePrivately(m) || /好室友/.test(m.room().topic())) {
    await maybeCreateUser(m);
    if (m.type() == MsgType.IMAGE) {
      logger.info(`${m.from().name()} sent an image.`);
      let publicId = await saveImgFileFromMsg(m);
      logger.info(
          `Uploaded image ${publicId} to cloudinary, now update the database, in group` +
          `${HsyUtil.getHsyGroupEnum(m.room().topic())}`);
      let uid = await HsyBotLogger.logListingImage(m,
          HsyUtil.getHsyGroupEnum(m.room().topic()), publicId);
      if (process.env.FULL_FEATURE) await m.from().say(`你好，你${
          WeChatyApiX.isTalkingToMePrivately(m) ? '私下' : `在${m.room().topic()} 里面`}
        发的租房图片我们已经同时发布到好室友™网站和App上了，欢迎查看和分享，链接为 ${HsyUtil.getLinkByHsyListingUid(uid)}&utm_campaign=message_generation`);
    } else {
      logger.info(`${m.from().name()} say: ${m.content()}`);
      if (m.content().length >= 80 &&
          /租|rent|roomate|小区|公寓|lease/.test(m.content())) {
        let uid = await HsyBotLogger.logListing(m, HsyUtil.getHsyGroupEnum(m.room().topic()));
        if (process.env.FULL_FEATURE) await m.from().say(`你好，你${
            WeChatyApiX.isTalkingToMePrivately(m) ? '私下' : `在${m.room().topic()} 里面`}
        发的租房信息我们已经同时发布到好室友™网站和App上了，欢迎查看和分享，链接为 ${HsyUtil.getLinkByHsyListingUid(uid)}&utm_campaign=message_generation`);
      }
    }
    return true;
  }
  return false;
};

let maybeDownsizeKeyRoom = async function(keyRoom: Room, c:Contact) {
  if (/老友/.test(keyRoom.topic())) return;
  if (keyRoom.memberList().length >= groupDownSizeTriggerThreshold) { // triggering
    if (process.env.FULL_FEATURE) await keyRoom.say(hsyGroupClearMsg);
    let potentialRotationList = [];
    let noGroupNickNames = [];
    let cList:Contact[] = keyRoom.memberList();
    let shouldRemoveSize = cList.length - groupDownSizeTarget;
    let shouldRemoveList = [];
    for (let i = 0; i < keyRoom.memberList().length - newComerSize/* never newComer */; i++) {
      let c:Contact = cList[i];
      if (c.self()) continue; // never does anything with the bot itself.
      let groupNickName = WeChatyApiX.getGroupNickNameFromContact(c);
      if (/^(管|介|群主)-/.test(groupNickName) || /管理员/.test(c.alias())) {
        logger.info(`略过管理员 ${c.name()}, 群里叫做 ` +
            `${WeChatyApiX.getGroupNickNameFromContact(c)}，备注${c.alias()}`);
        // pass, never remove
      } else if (/^(招|求)租/.test(groupNickName)) {
        // good format, but need to rotate
        potentialRotationList.push(c);
      } else {
        noGroupNickNames.push(c);
      }
      if (noGroupNickNames.length >= shouldRemoveSize) {
        shouldRemoveList = noGroupNickNames;
        break;
      } else if (noGroupNickNames.length + potentialRotationList.length >= shouldRemoveSize) {
        shouldRemoveList = noGroupNickNames
            .concat(potentialRotationList.slice(0,
                shouldRemoveSize - noGroupNickNames.length));
        break;
      }
    }
    if (shouldRemoveList.length > 0) {
      if (process.env.FULL_FEATURE) await c.say(`群里有点儿满，我先清一下人哦`);
    }
    await Promise.all(shouldRemoveList.map(async (c:Contact) => {
      await HsyBotLogger.logDebug(`Deleting contact ${c.name()} from group ${keyRoom.topic()}`);
      let msg = (`亲 ~ 你在${keyRoom.topic()}里面`) +
          (/^(招|求)租/.test(WeChatyApiX.getGroupNickNameFromContact(c)) ?
              `待得比较久了，如果你已经在群里找到室友或者房子，恭喜你！`  +
              `请联系群主 周载南（微信号xinbenlv）加入"老友群"，` :
              `没有按照规则修改群昵称，`) +
          `这里我先把你挪出本群哈，随时加我（小助手，微信号haoshiyou-bot）重新入群。` + hsyReferMsg;
      if (process.env.FULL_FEATURE) await c.say(msg);
      await keyRoom.del(c);
    }));
  } else {
    logger.info(`Group Size of ${keyRoom.topic()} is ` +
        `still good (${keyRoom.memberList().length}).`)
  }
};

let maybeAddToHsyGroups = async function(m:Message):Promise<Boolean> {
  if (!process.env.FULL_FEATURE) return false;
  const contact = m.from();
  const content = m.content();
  const room = m.room();
  // only to me or entry group
  if (WeChatyApiX.isTalkingToMePrivately(m) || /好室友.*入口群/.test(m.room().topic())) {
    logger.debug(`${contact.name()}(weixin:${contact.weixin()}) sent a message ` +
        `type: ${m.type()} ` +
        `content: ${m.content()}`);
    let groupToAdd:HsyGroupEnum = null;
    if (/加群/.test(content)) {
      if (process.env.FULL_FEATURE) await m.say(greetingsMsg);
      return;
    } else {
      groupToAdd = HsyUtil.getAddGroupIndentFromMessage(content);
    }
    if (groupToAdd == HsyGroupEnum.None) { // found no valid group
      if (process.env.FULL_FEATURE) await m.say(hsyCannotUnderstandMsg);
    } else {
      await logger.info(`Start to add ${contact} to room ${groupToAdd}.`);
      await HsyBotLogger.logBotAddToGroupEvent(contact, groupToAdd);
      if (process.env.FULL_FEATURE) await m.say(`好的，你要加${getStringFromHsyGroupEnum(groupToAdd)}的群对吧，我这就拉你进群。`);
      if (await HsyUtil.isHsyBlacklisted(m.from())) {
        logger.info(`黑名单用户 ${WeChatyApiX.contactToStringLong(m.from())}申请加入${groupToAdd}`);
        if (process.env.FULL_FEATURE) await m.say(`我找找啊`);
        if (process.env.FULL_FEATURE) await m.say(`不好意思，这个群暂时满了，我清理一下请稍等...`);
        let teamRoom = await HsyUtil.findHsyRoomByKey("大军团");
        if (process.env.FULL_FEATURE) await teamRoom.say(`黑名单用户 ${WeChatyApiX.contactToStringLong(m.from())}` +
            `申请加入${groupToAdd}, 我已经把他忽悠了。`);
        return; // early exit
      }
      let keyRoom = await HsyUtil.findHsyRoomByEnum(groupToAdd);
      if (keyRoom) {
        await maybeDownsizeKeyRoom(keyRoom, contact);
        if (process.env.FULL_FEATURE) await keyRoom.add(contact);
        if (process.env.FULL_FEATURE) await contact.say(hysAlreadyAddedMsg);
        if (process.env.FULL_FEATURE) await contact.say(hsyGroupNickNameMsg);
        if (process.env.FULL_FEATURE) await contact.say(hsyReferMsg);
      } else {
        if (process.env.FULL_FEATURE) await m.say(`囧...加群失败，请联系群主周载南(微信号:xinbenlv)。`);
        logger.info(`Can't find group ${groupToAdd}`);
      }
    }
    return true;
  }
  return false;
};

let maybeCreateUser = async function(m:Message):Promise<string /*userId*/ > {
  logger.trace(`Maybe create an user`);
  let c = m.from();
  let uid = HsyUtil.getHsyUserIdFromName(c.name());
  let q = new LoopbackQuerier();
  let user = await q.getHsyUserByUid(uid);
  if (user === null || user === undefined) {
    logger.info(`User of uid:${uid} does not exist, creating a user...`);
    user = new HsyUser();
    user.id = uid;
    user.name = c.name();
    user.created = new Date();

    if (!c.weixin()) {
      c = await c.refresh();
    }
    if (c.weixin()) user.weixin = c.weixin();
  } else {
    logger.trace(`User of uid:${uid} already existed`);
    logger.trace(`User stored: ${uid}: ${JSON.stringify(user)}`);
  }

  // TODO(zzn): avatar is sometimes currently empty file
  // user.avatarId = await savePic('tmp/img/' + c.name() + '.jpg', await c.avatar());
  user.lastUpdated = new Date();
  await q.setHsyUser(user);
  logger.info(`User of uid:${uid} created/updated: ${JSON.stringify(user)}`);
  return uid;
};

async function kickAndOrBlacklist(m: Message, admin: Contact, shouldBlacklist:boolean) {
  try {
    let splitted = m.content().split(' ');
    let memberToDelete: Contact = null;
    if (/^@/.test(splitted[1])) { // delete by id
      let memberId = splitted[1];
      if (memberId in MEMORY_memberIdToMemberMap) {
        memberToDelete = MEMORY_memberIdToMemberMap[memberId];
      } else {
        let groups = await HsyUtil.findAllRentalHsyGroups();
        for(let group of groups) {
          let found = group.memberList().filter(c => c.id == memberId);
          if (found.length>0) {
            memberToDelete = found[0];
            break;
          }
        }
        if (memberToDelete == null) {
          if (process.env.FULL_FEATURE) await admin.say(`加黑时候找不到用户信息，请先发出命令"查重复"`);
          return;
        }
        // else does nothing, fall through
      }
    } else { // delete by number
      let groupShortName = splitted[1];
      let groupEnum = HsyUtil.getAddGroupIndentFromMessage(groupShortName);
      let group = await HsyUtil.findHsyRoomByEnum(groupEnum);
      let groupMemberList = group.memberList();
      let num = parseInt(splitted[2]);
      memberToDelete = groupMemberList[num];
    }
    await HsyUtil.kickFromAllHsyGroups(memberToDelete);
    if (shouldBlacklist) {
      if (process.env.FULL_FEATURE) await HsyUtil.addToBlacklist(memberToDelete);
      if (process.env.FULL_FEATURE) await admin.say(`加黑完成：${WeChatyApiX.contactToStringLong(memberToDelete)} `);
    }

  } catch (e) {
    console.log(e);
    if (process.env.FULL_FEATURE) await admin.say(`加黑命令发生错误，请检查格式和数字`);

  }
}

async function checkOrKickRepeat(m: Message, admin: Contact, shouldKick:boolean = false, longName:boolean = false) {
  let splitted = m.content().split(' ');
  let threshold: number = 4;
  if (splitted.length >= 2 && parseInt(splitted[1])) {
    threshold = parseInt(splitted[1]);
  }
  if (process.env.FULL_FEATURE) await admin.say(`开始查重复(threshold = ${threshold})...`);
  MEMORY_allGroups = []; // clear it each time
  MEMORY_memberIdToMemberMap = {}; // clear it each time
  let memberIdToCountMap = {};
  let overThresholdMemberList:Contact[] = [];
  MEMORY_allGroups = await HsyUtil.findAllRentalHsyGroups();
  for (let groupEnum of ALL_RENTAL_HSY_GROUP_ENUMS) {
    let group = await HsyUtil.findHsyRoomByEnum(groupEnum);
    if (group == null) continue;
    MEMORY_allGroups.push(group);
    if (process.env.FULL_FEATURE) await admin.say(`群: ${group.topic()}用户数为 ${group.memberList().length}`);
    for (let member of group.memberList()) {
      if (await HsyUtil.isHsyAdmin(member)) continue; // skip admins
      if (member.id in memberIdToCountMap) {
        memberIdToCountMap[member.id] = memberIdToCountMap[member.id] + 1;
      } else {
        memberIdToCountMap[member.id] = 1;
        MEMORY_memberIdToMemberMap[member.id] = member;
      }
    }
  }
  for (let memberId in memberIdToCountMap) {
    if (memberIdToCountMap[memberId] >= threshold) {
      overThresholdMemberList.push(MEMORY_memberIdToMemberMap[memberId]);
    }
  }
  let header = `查到重复人数为 ${overThresholdMemberList.length}:\n`;
  let nonAdminBuffer = '';
  for (let m of overThresholdMemberList) {
    nonAdminBuffer += `${longName ? WeChatyApiX.contactToStringLong(m) : m.name()}, 重复次数: ${memberIdToCountMap[m.id]}\n`;
  }
  let responseBuffer = header + `--- NonAdmins: ---\n` + nonAdminBuffer;
  if (process.env.FULL_FEATURE) await admin.say(responseBuffer);
  if (shouldKick) {

    for (let overThresholdMember of overThresholdMemberList) {
      for (let group of MEMORY_allGroups) {
        if (group.has(overThresholdMember)) {
          if (process.env.FULL_FEATURE) await group.del(overThresholdMember);
          if (process.env.FULL_FEATURE)  group.say(`把${overThresholdMember.name()}从本群里踢出`);
        }

      }
      if (process.env.FULL_FEATURE) await admin.say(`把${overThresholdMember.name()}从每个房间踢出了`);
    }
  }

}

let maybeAdminCommand = async function(m:Message) {
  if (WeChatyApiX.isTalkingToMePrivately(m) && await HsyUtil.isHsyAdmin(m.from())) {
    let admin = m.from();
    if (/状态/.test(m.content())) {
      logger.info(`管理员${WeChatyApiX.contactToStringLong(admin)} says a command 状态.`);
      if (process.env.FULL_FEATURE) await admin.say(`应${WeChatyApiX.contactToStringLong(admin)}的要求，` +
          `开始回报好室友系列群的状态，生成报告中....`);
      let friends = await Contact.findAll();
      let reportStr = `好室友小助手好友总数 = ${friends.length}\n`;
      let reports:Object[] = await Promise.all(
          ALL_HSY_GROUP_ENUMS.map(async (hsyGroupEnum:HsyGroupEnum):Promise<Object> => {
            logger.info(`生成了${getStringFromHsyGroupEnum(hsyGroupEnum)}的信息`);
            let room = await HsyUtil.findHsyRoomByEnum(hsyGroupEnum);
            if (room === null) {
              logger.warn(`Failed to get room for ${hsyGroupEnum}:${HsyGroupEnum[hsyGroupEnum]}`);
              return {group: getStringFromHsyGroupEnum(hsyGroupEnum), length: '-1'};
            } else return {
          group: getStringFromHsyGroupEnum(hsyGroupEnum),
          length: (room.memberList().length)
        };
      }));
      reports.forEach(report => {
        reportStr += `微信群 ${report['group']} 里面的人数为${report['length']}\n`;
      });
      reportStr += `汇报完毕\n`;
      if (process.env.FULL_FEATURE) await admin.say(reportStr);
      return true;
    } else if (/^列出/.test(m.content())) {
      try {
        let splitted = m.content().split(' ');
        // TODO(zzn): assert splitted.lenght == 4;
        let groupShortName = splitted[1];
        let lowerBound = parseInt(splitted[2]);
        let upperBound = parseInt(splitted[3]);
        // TODO(zzn): assert lowerBound and upperBound is number and lowerBound < upperBound
        let groupEnum = HsyUtil.getAddGroupIndentFromMessage(groupShortName);
        // TODO(zzn): assert group can be found
        let group = await HsyUtil.findHsyRoomByEnum(groupEnum);
        let groupMemberList = group.memberList();
        // TODO(zzn): assert lowerBound >= 0, assert upperBound <= groupMemberList.length
        let memberListSliceToDisplay = groupMemberList.slice(lowerBound, upperBound);
        let responseBuffer = '';
        for (let i = 0; i < memberListSliceToDisplay.length; i++) {
          let member = memberListSliceToDisplay[i];
          responseBuffer += `${i + lowerBound}. ${WeChatyApiX.contactToStringLong(member)} \n`;
        }

        responseBuffer += `\n

回复
- "踢 [群短名] [num]": 会把特定名称为[群短名]的那个租房群里面的第[num]个群友踢出去并在群内警告
- "加黑 [群短名] [num]": 会把特定名称为[群短名]的那个租房群里面的第[num]群友踢出去、加黑名单并在群内警告
- "踢 [@id]": 会把所有租房群里面的id为[@id]的群友踢出去并在群内警告
- "加黑 [@id]": 会把所有租房群里面的[@id]群友踢出去、加黑名单并在群内警告
`;
        if (process.env.FULL_FEATURE) await admin.say(responseBuffer);
      } catch (e) {
        if (process.env.FULL_FEATURE) await admin.say(`发生错误: ${e}`);
      }
      return true;
    } else if (/^踢 /.test(m.content())) {
      await kickAndOrBlacklist(m, admin, false);
      return true;
    } else if (/^加黑 /.test(m.content())) {
      await kickAndOrBlacklist(m, admin, true);
      return true;
    } else if (/^查重复 /.test(m.content())) {
      await checkOrKickRepeat(m, admin);
      return true;
    } else if (/^踢重复 /.test(m.content())) {
      await checkOrKickRepeat(m, admin, true);
      return true;
    } else {
      if (process.env.FULL_FEATURE) await admin.say(
`亲爱的管理员${admin.name()}你好，感谢你的辛勤劳动，群友们都感谢你！
以下是管理员命令(咒语):
1. 跟小助手私下说：
- "状态"：将返回小助手和微信群的状态
- "列出 [群短名] [lowerBound] [UpperBound]:" 将列出特定租房群里面的一些网友名称。例如 "列出 南湾西 0 9"：会列出南湾西群里的第0个到第9个网友的名称并包含序号，记得加空格
- "查重复 [limit]": 将列出同时在多个（超过[limit]个的群）好室友系列租房群的群友，以便进行清理和加黑。
- "踢重复 [limit]": 将踢出同时在多个（超过[limit]个的群）好室友系列租房群的群友，以便进行清理和加黑。
2. 在咱们好室友的群里面对人说话
  "@张三 请不要发无关消息"或者"@张三 请按要求修改群昵称"：将触发小助手重复你的话并私信你寻求黑名单指令
  
管理员辛苦啦~，更多小助手功能敬请期待。或者如果你想要什么功能，在大军团里面说一声吧~!
`);
    }
  }
  return false;
};



