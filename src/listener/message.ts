import {Room, Contact, Message, MsgType} from "wechaty";
import {HsyBotLogger} from "../datastore";
import { createWriteStream }  from 'fs';
import { Logger, LoggerConfig } from "log4ts";
import {LoopbackQuerier} from "../loopback-querier";
import {HsyUser} from "../../loopbacksdk/models/HsyUser";
import {HsyUtil, WeChatyApiX} from "../hsy-util";

const cloudinary = require('cloudinary');
const logger = Logger.getLogger(`main`);
const newComerSize = 200;
const groupDownSizeTarget = 465;
const groupDownSizeTriggerThreshold = 480;

import {
  hsyGroupClearMsg, hsyCannotUnderstandMsg, hysAlreadyAddedMsg,
  hsyGroupNickNameMsg, greetingsMsg, GLOBAL_blackListCandidates
} from "../global";
import {HsyGroupEnum} from "../model";

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

exports = module.exports = async function onMessage(m) {
  await HsyBotLogger.logRawChatMsg(m);
  if (!HsyUtil.shouldCareAboutMessage(m)) return; // We don't care

  logger.trace(`Got a msg type: ${m.type()}`);
  if (HsyUtil.isAdmin(m.from())) {
    logger.info(`A message from Admin`);
  } else if (HsyUtil.isBlacklisted(m.from())) {
    logger.info(`A message from Blacklisted`);
  }

  await maybeBlacklistUser(m) || // if true stops further processing
  await maybeAddToHsyGroups(m) || // if true stops further processing
  await maybeExtractPostingMessage(m);
};

let findMemberFromGroup = function(room:Room, regExp:RegExp):Array<Contact> {
  return room.memberList().filter(c => {
    return regExp.test(c.name()) || regExp.test(c.remark())
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
          cloudinary.uploader.upload(filename, function(result, error) {
            if (error) {
              logger.warn(`There is an error in saveMediaFile upload of cloudinary`);
              logger.warn(error);
              reject(error);
            } else {
              logger.trace(`Uploaded an image:` + JSON.stringify(result));
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
 * @returns {Promise<boolean>} true if the message is processed (and should not be processed anymore)
 */
let maybeBlacklistUser = async function(m: Message):Promise<Boolean> {
  if(HsyUtil.isAdmin(m.from())
      && WeChatyApiX.isTalkingToMePrivately(m)
      && /加黑名单/.test(m.content())) {
    let admin = m.from();
    let blackListObj = GLOBAL_blackListCandidates[m.from().remark()];
    // not able to find a blacklist candidate.
    if (blackListObj === undefined || blackListObj === null) return false;
    let timeLapsedInSeconds = (Date.now() - blackListObj.time) / 1000;
    if (blackListObj !== null && blackListObj !== undefined) {
      if ( timeLapsedInSeconds>  60 * 5) {
        await m.say(`从刚才群内警告到现在确认加黑名单已经过了${(timeLapsedInSeconds)/60}分钟，太久了，请重新警告`);
        delete GLOBAL_blackListCandidates[m.from().remark()];
      } else {
        let indexOfCandidate = m.content().slice(4); //"加黑名单1"取编号
        let contactToBlacklist:Contact = blackListObj.candidates[indexOfCandidate];

        await admin.say(`正在把用户加入黑名单，${WeChatyApiX.contactToStringLong(contactToBlacklist)}...`);
        await HsyUtil.addToBlacklist(contactToBlacklist);

        let teamRoom = await HsyUtil.findRoomByKey("大军团");
        await teamRoom.say(`应管理员${admin}的要求，` +
            `正在踢出用户${WeChatyApiX.contactToStringLong(contactToBlacklist)}...`);
        await HsyUtil.kickFromAllHsyGroups(contactToBlacklist);
        await teamRoom.say(`已完成`);
        await admin.say(`搞定!`);
      }
    }
    return true;
  } else if (HsyUtil.isAdmin(m.from()) &&
      m.room() !== null &&
      /好室友/.test(m.room().topic()) &&
      /无关|修改群昵称/.test(m.content()) &&
      /^@/.test(m.content())) {
    let mentionName = m.content().slice(1)/*ignoring@*/.replace(" "/*Space Char in Chinese*/, " ").split(" ")[0];
    logger.debug(`寻找mentionName = ${mentionName}`);
    let foundUsers = findMemberFromGroup(m.room(), new RegExp(mentionName));
    foundUsers = foundUsers.filter(c=> {
      if (c.self()) {
        logger.trace(`Ignoring SELF ${WeChatyApiX.contactToStringLong(c)}`);
        return false;
      } else if (HsyUtil.isAdmin(c)) {
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
        m.room().say(`感谢管理员@${m.from().name()}\n\n${m.content()}`);

        let buffer = `管理员 ${m.from().name()}，你好，你刚才在${m.room().topic()}这个群里警告了用户@${mentionName}，符合这个名称的群内的用户有：\n`;
        for (let i = 0; i < foundUsers.length; i++) {
          let candidate = foundUsers[i];
          buffer += `${i}. 昵称:${candidate.name()}, 备注:${candidate.remark()}, 群昵称: ${WeChatyApiX.getGroupNickNameFromContact(candidate)} \n`;
        }
        buffer += `请问要不要把这个用户加黑名单？五分钟内回复 "加黑名单[数字编号]"\n`;
        buffer += `例如 "加黑名单0"` + `将会把${foundUsers[1]} 加入黑名单:${WeChatyApiX.contactToStringLong(foundUsers[0])}`;
        await m.from().say(buffer);
        GLOBAL_blackListCandidates[m.from().remark()] = {
          time: Date.now(),
          candidates: foundUsers
        };
      }
    } else {
      logger.warn(`Didn't found the user being warned against: ${mentionName}.`);
      logger.warn(`Full Member List of Group ${m.room().topic()}:`);
      logger.warn(`${m.room().memberList()}:`);
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
    let userId = maybeCreateUser(m);
    if (m.type() == MsgType.IMAGE) {
      logger.info(`${m.from().name()} sent an image.`);
      let publicId = await saveImgFileFromMsg(m);
      logger.info(
          `Uploaded image ${publicId} to cloudinary, now update the database, in group` +
          `${HsyUtil.getHsyGroupEnum(m.room().topic())}`);
      await HsyBotLogger.logListingImage(m, HsyUtil.getHsyGroupEnum(m.room().topic()), publicId);
    } else {
      logger.info(`${m.from().name()} say: ${m.content()}`);
      if (m.content().length >= 80 &&
          /租|rent|roomate|小区|公寓|lease/.test(m.content())) {
        HsyBotLogger.logListing(m, HsyUtil.getHsyGroupEnum(m.room().topic()));
      }
    }
    return true;
  }
};

let maybeDownsizeKeyRoom = async function(keyroom: Room, c:Contact) {
  if (/老友/.test(keyroom.topic())) return;
  if (keyroom.memberList().length >= groupDownSizeTriggerThreshold) { // triggering
    await keyroom.say(hsyGroupClearMsg);
    let potentialRotationList = [];
    let noGroupNickNames = [];
    let cList:Contact[] = keyroom.memberList();
    let shouldRemoveSize = cList.length - groupDownSizeTarget;
    let shouldRemoveList = [];
    for (let i = 0; i < keyroom.memberList().length - newComerSize/* never newComer */; i++) {
      let c:Contact = cList[i];
      if (c.self()) continue; // never does anything with haoshiyou-admin itself.
      let groupNickName = WeChatyApiX.getGroupNickNameFromContact(c);
      if (/^(管|介|群主)-/.test(groupNickName) || /管理员/.test(c.remark())) {
        logger.info(`略过管理员 ${c.name()}, 群里叫做 ${WeChatyApiX.getGroupNickNameFromContact(c)}，备注${c.remark()}`);
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
      await c.say(`群里有点儿满，我先清一下人哦`);
    }
    await Promise.all(shouldRemoveList.map(async (c:Contact) => {
      await HsyBotLogger.logDebug(`Deleting contact ${c.name()} from group ${keyroom.topic()}`);
      let msg = (`亲 ~ 你在${keyroom.topic()}里面`) +
          (/^(招|求)租/.test(WeChatyApiX.getGroupNickNameFromContact(c)) ?
              `待得比较久了，如果你已经在群里找到室友或者房子，恭喜你！`  +
              `请联系群主 周载南（微信号xinbenlv）加入"老友群"，` :
              `没有按照规则修改群昵称，`) +
          `这里我先把你挪出本群哈，随时加我（小助手，微信号haoshiyou-admin）重新入群。`;
      await c.say(msg);
      await keyroom.del(c);
    }));
  } else {
    logger.info(`Group Size of ${keyroom.topic()} is ` +
        `still good (${keyroom.memberList().length}).`)
  }
};

let maybeAddToHsyGroups = async function(m:Message):Promise<Boolean> {
  const contact = m.from();
  const content = m.content();
  const room = m.room();
  let groupType:HsyGroupEnum;
  // only to me or entry group
  if (WeChatyApiX.isTalkingToMePrivately(m) || /好室友.*入口群/.test(m.room().topic())) {
    logger.debug(`${contact.name()}(weixin:${contact.weixin()}) sent a message ` +
        `type: ${m.type()} ` +
        `content: ${m.content()}`);
    let groupToAdd = null;
    if (/加群/.test(content)) {
      await m.say(greetingsMsg);
      return;
    } else if (/南湾西|Mountain View|mtv|sv|Sunnyvale|Palo Alto|Stanford|Facebook|Google|Menlo Park/.test(content)) {
      groupToAdd = "南湾西";
      groupType = HsyGroupEnum.SouthBayEast;
    } else if (/南湾东|Milpitas|San Jose|Santa Clara|SJ|Campbell|Los Gatos/.test(content)) {
      groupToAdd = "南湾东";
      groupType = HsyGroupEnum.SouthBayWest;
    } else if (/东湾|奥克兰|伯克利|Berkeley|Fremont|Hayward|Newark/.test(content)) {
      groupToAdd = "东湾";
      groupType = HsyGroupEnum.EastBay;
    } else if (/(中)半岛|Redwood|San Carlos|San Mateo|Burlingame|Millbrae|San Bruno/.test(content)) {
      groupToAdd = "中半岛";
      groupType = HsyGroupEnum.MidPeninsula;
    } else if (/旧金山|三番|San Francisco|Uber|AirBnb/.test(content)) {
      groupToAdd = "三番";
      groupType = HsyGroupEnum.SanFrancisco;
    } else if (/西雅图/.test(content)) {
      groupToAdd = "西雅图";
      groupType = HsyGroupEnum.Seattle;
    } else if (/短租/.test(content)) {
      groupToAdd = "短租";
      groupType = HsyGroupEnum.ShortTerm;
    } else if (/测试/.test(content)) {
      groupToAdd = "测试";
      groupType = HsyGroupEnum.TestGroup;
    } else if (/老友/.test(content)) {
      groupToAdd = "老友";
      groupType = HsyGroupEnum.OldFriends;
    }
    if (groupToAdd == null) { // found no valid group
      await m.say(hsyCannotUnderstandMsg);
    } else {
      await logger.info(`Start to add ${contact} to room ${groupToAdd}.`);
      await HsyBotLogger.logBotAddToGroupEvent(contact, groupType);
      await m.say(`好的，你要加${groupToAdd}的群对吧，我这就拉你进群。`);
      if (HsyUtil.isBlacklisted(m.from())) {
        logger.info(`黑名单用户 ${WeChatyApiX.contactToStringLong(m.from())}申请加入${groupToAdd}`);
        await m.say(`我找找啊`);
        await m.say(`不好意思，这个群暂时满了，我清理一下请稍等...`);
        let teamRoom = await HsyUtil.findRoomByKey("大军团");
        teamRoom.say(`黑名单用户 ${WeChatyApiX.contactToStringLong(m.from())}申请加入${groupToAdd}, 我已经把他忽悠了。`);
        return; // early exit
      }
      let typeRegEx = new RegExp(`好室友.*` + groupToAdd);
      let keyroom = await Room.find({topic: typeRegEx});
      if (keyroom) {
        await maybeDownsizeKeyRoom(keyroom, contact);
        await keyroom.add(contact);
        await contact.say(hysAlreadyAddedMsg);
        await contact.say(hsyGroupNickNameMsg);
      } else {
        await m.say(`囧...加群失败，请联系群主周载南(微信号:xinbenlv)。`);
        logger.info(`Can't find group ${groupToAdd}`);
      }
    }
    return true;
  }
  return false;
};

let maybeCreateUser = async function(m:Message):Promise<string/*userId*/> {
  logger.trace(`Maybe create an user`);
  let c = m.from();
  let uid = HsyUtil.getUserIdFromName(c.name());
  let q = new LoopbackQuerier();
  let user = await q.getHsyUserByUid(uid);
  if (!c.weixin()) {
    c = await c.refresh();
  }
  logger.trace(`Got user of uid:${uid}: ${JSON.stringify(user)}`);
  if (user === null || user === undefined) {
    user = new HsyUser();
    user.id = uid;
    user.name = c.name();
    user.created = new Date();
    user.weixin = c.weixin();
    logger.trace(`User of uid:${uid} does not exist, creating a user...`);
  } else {
    logger.trace(`User of uid:${uid} already existed`);
  }
  // TODO(zzn): avatar is currently empty file
  // user.avatarId = await savePic('tmp/img/' + c.name() + '.jpg', await c.avatar());
  user.lastUpdated = new Date();
  await q.setHsyUser(user);
  logger.trace(`User of uid:${uid} created/updated: ${JSON.stringify(user)}`);
  return uid;
};
