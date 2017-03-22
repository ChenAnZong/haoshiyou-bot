import {Wechaty, Room, Contact, Message, FriendRequest, MsgType} from "wechaty";
import {HsyBotLogger, HsyGroupEnum} from "./datastore";
import { createWriteStream }  from 'fs';
import { Logger, LoggerConfig } from "log4ts";
import ConsoleAppender from "log4ts/build/appenders/ConsoleAppender";
import BasicLayout from "log4ts/build/layouts/BasicLayout";
import {LogLevel} from "log4ts/build/LogLevel";
import {LoopbackQuerier} from "./loopback-querier";
import {HsyUser} from "./loopbacksdk/models/HsyUser";
import {HsyUtil} from "./hsy-util";

const bot = Wechaty.instance();
const cloudinary = require('cloudinary');
const newComerSize = 200;
const groupDownSizeTarget = 465;
const groupDownSizeTriggerThreshold = 480;
let appender = new ConsoleAppender();
let layout = new BasicLayout();
appender.setLayout(layout);
let config = new LoggerConfig(appender);
config.setLevel(LogLevel.ALL);
Logger.setConfig(config);

const GROUP_DICT = {
  "南湾西":HsyGroupEnum.SouthBayWest,
  "南湾东":HsyGroupEnum.SouthBayEast,
  "东湾":HsyGroupEnum.EastBay,
  "中半岛":HsyGroupEnum.MidPeninsula,
  "西雅图":HsyGroupEnum.Seattle,
  "短租":HsyGroupEnum.ShortTerm,
  "测试":HsyGroupEnum.TestGroup,
  "老友":HsyGroupEnum.OldFriends,
  "大军团": HsyGroupEnum.BigTeam
};

// Used as a global variable
// TODO(zzn): maybe move to database or at least consider use a interface
let GLOBAL_blackListCandidates = {
  // 'adminRemark': { time: unixTime, candidates: [blaclistUser1, blacklistUser2]}
};

let Global_allManagedGroups = {
  // HsyGroupEnum.value: Room instance
};

const logger = Logger.getLogger(`main`);
if (process.env.CLOUDINARY_SECRET !== undefined && process.env.CLOUDINARY_SECRET.length > 0) {
  cloudinary.config({
    cloud_name: 'xinbenlv',
    api_key: '999284541119412',
    api_secret: process.env.CLOUDINARY_SECRET
  });

} else {
  logger.error('Need to specify cloudinary secret by export CLOUDINARY_SECRET="some_secret" .');
  process.exit();
}

const hsyCannotUnderstandMsg = `小助手没听懂你说啥意思哈，回复【加群】了解怎样加入租房群。`;
const hsyGreetingsMsg =
    `你好，谢谢你加我们群，请问你要在哪个区域找房子或者室友？\n` +
    `我们是按照区域分群的。我拉你入群：\n` +
    `  【南湾西】包含Palo Alto，Stanford, Mountain View，Sunnyvale，Cupertino一带；\n` +
    `  【南湾东】包含San Jose，Santa Clara，Milpitas一带；\n` +
    `  【东湾】湾东边Milpitas以北，包括Fremont，Hayward，Berkeley等；\n` +
    `  【中半岛】Redwood以北，San Francisco以南；\n` +
    `  【三番】旧金山(San Francisco)城里，含South San Francisco；\n`+
    `  【西雅图】我们新开设了西雅图好室友群，服务大西雅图地区；\n`+
    `  【短租】如果你希望在旧金山湾区任意地方内进行3个月以内短租（出租和求租），请加短租群；\n`+
    `请回复要加哪个群，例如： 南湾西\n` +
    `另外如果你在我们群里找到了室友或者房子，欢迎加入我们的【好室友】"老友群"，闲聊~，` +
    `详情请私信群主周载南(wechat:xinbenlv)或者入口群里的管理员们`;

const hysAlreadyAddedMsg = `已邀请，请点击加入[湾区好室友]系列租房群。`;

const hsyGroupNickNameMsg = `
 
提醒一下小伙伴记得按照要求修改群昵称哦，格式为“求/招-区域-时间-全真名”，
例如 "求-SV-3月-王小明"表示你是王小明，求租3月在Sunnyvale附近的房子。
请大家把昵称改为如下格式：“招/求/-地点-时间-真全名”，例如:
 
“招-mtv-5/1-王小明”表示你是王小明，招租房客，房子地点在 Mountain View，时间5月1日开始。 
“求-pa-4/12-韩梅梅”表示你是韩梅梅，求租房子，房子地点在 Palo Alto，时间4月1日开始。 
“介-李雷”表示你是李雷，在群里目前没有需求，仅为了介绍朋友进群。“介”这类可以不写时间地点。 

本群中对地点常用缩写约定如下：
  SF-San Francisco,  
  PA-Palo Alto,  
  MTV-Mountain View,  
  SV-Sunnyvale,  
  FMNT-Fremont,  
  SJ-San Jose,
  MPTS-Milpitas,
  SEA - Seattle
  KIR - Kirkland
  
好室友系列租房群会自动定期清理没有修改群昵称的群友，以及最早的群友以便给新人腾位置。
`;

const hsyGroupClearMsg =
    `亲爱的各位好室友租房群的群友们，现在群快满了，清理一批群友给新朋友们腾位置。\n` +
    `我们主要清理两类朋友：\n` +
    `  1. 没有按照改群昵称的朋友，如果你的群昵称不是以'招'、'求'、'介'开头，那么你可能会被优先清理；\n` +
    `  2. 如果你的入群时间比较长，那么我们会请你优先离群，把空位流动起来（可以重新回来）；\n` +
    `若仍有需求，欢迎私信好室友小助手（微信号：haoshiyou-admin）重新加群哈~\n`;
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
let waitForLoading = async function() {
  let rooms;
  for (let i = 1; i < 10; i ++) {
    await sleep(1000);
    rooms = await Room.findAll();
    console.log(`All room(#${i} iterations): ${(rooms).length}`);
    // if (cs.length > 140) {
    //   console.log(`Complete waiting!`);
    //   break;
    // }
  }
  await Promise.all(rooms.map(async (r:Room):Promise<void> => {
    console.log(`XXX DEBUG Room topic display.`);
    await r.refresh();
    await r.ready();
    console.log(`XXX DEBUG Room topic: ${r.topic()}, isReady = ${r.isReady()}.`);
    return;
  }));
  console.log(`XXX DEBUG DONE Complete waiting!`);
};
let registerAllManagedGroups = async function() {
  logger.info(`Start registering all rooms(groups)`);
  for(let key in GROUP_DICT) {
    let enumValue = GROUP_DICT[key];
    let typeRegEx = new RegExp(`【好室友】` + key);

    logger.info(`Looking for room room ${typeRegEx}...`);
    let room = await Room.find({topic: typeRegEx});
    Global_allManagedGroups[enumValue] =  room;
    logger.info(`Registering room ${room.topic()}...`);
  }
};

bot
    .on('scan', async (url, code) => {
      await HsyBotLogger.logDebug(`Please scan the QR code for URL ${url}.`);
      let loginUrl = url.replace('qrcode', 'l');
      require('qrcode-terminal').generate(loginUrl);
    })

    .on('login', async user => {
      await logger.info(`${user} logged in`);
      // await waitForLoading();
      // await registerAllManagedGroups();

    })

    .on('logout', async user => {
      await logger.info(`${user} logged out.`);
    })

    .on('friend', async (contact, request:FriendRequest) => {
      await HsyBotLogger.logFriendRequest(request);
      if (request) {  // 1. request to be friend from new contact
        await request.accept();
        await contact.say(hsyGreetingsMsg);
      } else {        // 2. confirm friend ship
        await logger.info('new friend ship confirmed with ' + contact);
      }
    })

    .on('message', async (m) => {
      await HsyBotLogger.logRawChatMsg(m);
      if (m.self()) {
        return; // Early return for talking to myself.
      }
      logger.debug(`Got a msg type: ${m.type()}`);
      if (isAdmin(m.from())) {
        logger.info(`A message from Admin`);
      } else if (isBlacklisted(m.from())) {
        logger.info(`A message from Blacklisted`);
      }

      await maybeBlacklistUser(m) || // if true stops further processing
      await maybeAddToHsyGroups(m) || // if true stops further processing
      await maybeExtractPostingMessage(m);
    })

    .init()
    .then(async _ => await logger.info(`HsyBot is terminated`))
    .catch(e => logger.error(e));

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
      let groupNickName = getGroupNickNameFromContact(c);
      if (/^(管|介|群主)-/.test(groupNickName) || /管理员/.test(c.remark())) {
        logger.info(`略过管理员 ${c.name()}, 群里叫做 ${getGroupNickNameFromContact(c)}，备注${c.remark()}`);
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
          (/^(招|求)租/.test(getGroupNickNameFromContact(c)) ?
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

let findRoomByKey = async function(key:string):Promise<Room> {
  let typeRegEx = new RegExp("【好室友】" + key);
  return await Room.find({topic: typeRegEx});
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
  if(isAdmin(m.from()) && isTalkingToMePrivately(m) && /加黑名单/) {
    let blackListObj = GLOBAL_blackListCandidates[m.from().remark()];
    let timeLapsedInSeconds = (Date.now() - blackListObj.time) / 1000;
    if (blackListObj !== null && blackListObj !== undefined) {
      if ( timeLapsedInSeconds>  60 * 5) {
        await m.say(`从刚才群内警告到现在确认加黑名单已经过了${(timeLapsedInSeconds)/60}分钟，太久了，请重新警告`);
        delete GLOBAL_blackListCandidates[m.from().remark()];
      } else {
        let indexOfCandidate = m.content().slice(4); //"加黑名单1"取编号
        await m.say(`正在把用户${indexOfCandidate}, ${contactToStringLong(blackListObj.candidates[indexOfCandidate])}，加入黑名单...`);
        let contactToBlacklist:Contact = blackListObj.candidates[indexOfCandidate];
        contactToBlacklist.remark(contactToBlacklist.name().slice(0,5)/*in case too long of name*/ + '#黑名单');
        let teamRoom = await findRoomByKey("大军团");
        await teamRoom.say(`应管理员${m.from()}的邀请，正在踢出用户${contactToStringLong(contactToBlacklist)}...`);
        for (let key in GROUP_DICT) {
          let room = await findRoomByKey(key);
          await m.say(`正在从${room.topic()}群中踢出该用户...`);
          if(contactToBlacklist.self()) {
            logger.warn(`WARNING WARNING WARINING attempt to delet myeself!`);
          } else await room.del(contactToBlacklist);
          logger.debug(`Deleting ... `);
          await m.say(`已从从${room.topic()}群中踢出该用户.`);
        }

        await teamRoom.say(`已完成`);
        await m.say(`搞定!`);
      }
    }
    return true;
  } else if (isAdmin(m.from()) &&
      /好室友/.test(m.room().topic()) &&
      /无关|修改群昵称/.test(m.content()) &&
      /^@/.test(m.content())) {
    let mentionName = m.content().slice(1)/*ignoring@*/.replace(" "/*Space Char in Chinese*/, " ").split(" ")[0];
    logger.debug(`寻找mentionName = ${mentionName}`);
    let foundUsers = findMemberFromGroup(m.room(), new RegExp(mentionName));
    foundUsers = foundUsers.filter(c=> {
      if (c.self()) {
        logger.debug(`Ignoring SELF ${contactToStringLong(c)}`);
        return false;
      } else if (isAdmin(c)) {
        logger.debug(`Ignoring ADMIN ${contactToStringLong(c)}`);
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
          buffer += `${i}. 昵称:${candidate.name()}, 备注:${candidate.remark()}, 群昵称: ${getGroupNickNameFromContact(candidate)} \n`;
        }
        buffer += `请问要不要把这个用户加黑名单？五分钟内回复 "加黑名单[数字编号]"\n`;
        buffer += `例如 "加黑名单0"` + `将会把${foundUsers[1]} 加入黑名单:${contactToStringLong(foundUsers[0])}`;
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
let findMemberFromGroup = function(room:Room, regExp:RegExp):Array<Contact> {
  return room.memberList().filter(c => {
    return regExp.test(c.name()) || regExp.test(c.remark())
        || regExp.test(getGroupNickNameFromContact(c));
  });
};

let maybeAddToHsyGroups = async function(m:Message):Promise<Boolean> {
  const contact = m.from();
  const content = m.content();
  const room = m.room();
  let groupType:HsyGroupEnum;
  // only to me or entry group
  if (isTalkingToMePrivately(m) || /好室友.*入口群/.test(m.room().topic())) {

    logger.debug(`${contact.name()}(weixin:${contact.weixin()}) sent a message ` +
        `type: ${m.type()} ` +
        `content: ${m.content()}`);
    let groupToAdd = null;
    if (/加群/.test(content)) {
      await m.say(hsyGreetingsMsg);
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
      if (isBlacklisted(m.from())) {
        logger.info(`黑名单用户 ${contactToStringLong(m.from())}申请加入${groupToAdd}`);
        await m.say(`我找找啊`);
        await m.say(`不好意思，这个群暂时满了，我清理一下请稍等...`);
        let teamRoom = await findRoomByKey("大军团");
        teamRoom.say(`黑名单用户 ${contactToStringLong(m.from())}申请加入${groupToAdd}, 我已经把他忽悠了。`);
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

let isBlacklisted = function(c:Contact) {
  return /#黑名单$/.test(c.remark());
};
let isAdmin = function(c:Contact) {
  return /#管理员$/.test(c.remark());
};
let isTalkingToMePrivately = function(m:Message) {
  return m.rawObj['MMIsChatRoom'] == false;
};

/**
 * @returns {Promise<boolean>} true if the message is processed (and should not be processed anymore)
 */
let maybeExtractPostingMessage = async function(m:Message):Promise<Boolean> {
  if (isTalkingToMePrivately(m) || /好室友/.test(m.room().topic())) {
    let userId = maybeCreateUser(m);
    if (m.type() == MsgType.IMAGE) {
      logger.info(`${m.from().name()} sent an image.`);
      let publicId = await saveImgFileFromMsg(m);
      logger.info(
          `Uploaded image ${publicId} to cloudinary, now update the database, in group` +
          `${getHsyGroupEnum(m.room())}`);
      await HsyBotLogger.logListingImage(m, getHsyGroupEnum(m.room()), publicId);
    } else {
      logger.info(`${m.from().name()} say: ${m.content()}`);
      if (m.content().length >= 80 &&
          /租|rent|roomate|小区|公寓|lease/.test(m.content())) {
        HsyBotLogger.logListing(m, getHsyGroupEnum(m.room()));
      }
    }
    return true;
  }
};

let getGroupNickNameFromContact = function(c:Contact) {
  return c['rawObj']['DisplayName'];
};

let contactToStringLong = function(c:Contact):string {
  return `昵称:${c.name()}, 备注:${c.remark()}, 群昵称: ${getGroupNickNameFromContact(c)}`;
};

let getHsyGroupEnum = function(room) {
  let topic = room.topic();
  if (!/好室友/.test(topic)) return HsyGroupEnum.None;
  else if (/旧金山/.test(topic)) {
    return HsyGroupEnum.SanFrancisco;
  } else if (/中半岛/.test(topic)) {
    return HsyGroupEnum.MidPeninsula;
  } else if (/南湾西/.test(topic)) {
    return HsyGroupEnum.SouthBayEast;
  } else if (/南湾东/.test(topic)) {
    return HsyGroupEnum.SouthBayEast;
  } else if (/东湾/.test(topic)) {
    return HsyGroupEnum.EastBay;
  } else if (/老友/.test(topic)) {
    return HsyGroupEnum.OldFriends;
  } else if (/西雅图/.test(topic)) {
    return HsyGroupEnum.Seattle;
  }
  return HsyGroupEnum.None;
};
let savePic = async function(filename:string, picStream:NodeJS.ReadableStream):Promise<string> {
  logger.debug('IMAGE local filename: ' + filename);
  const fileStream = createWriteStream(filename);
  let stream = await picStream;
  // TODO(xinbenlv): this might cause the error of following
  //   unhandledRejection: Error: not a media message [object Promise]
  return new Promise<string>( /* executor */ function(resolve, reject) {
    stream.pipe(fileStream)
        .on('close', () => {
          logger.debug('finish readyStream()');
          cloudinary.uploader.upload(filename, function(result, error) {
            if (error) {
              logger.warn(`There is an error in saveMediaFile upload of cloudinary`);
              logger.warn(error);
              reject(error);
            } else {
              logger.info(`Uploaded an image:` + JSON.stringify(result));
              resolve(result.public_id);
            }
          });
        });
  }).then(publicId => {
    logger.debug(`The PublicId result is ${publicId}`);
    return publicId;
  });
};
let saveImgFileFromMsg = async function(message: Message):Promise<any> {
  const filename = 'tmp/img/' + message.filename();
  return await savePic(filename, await message.readyStream());
};


let maybeCreateUser = async function(m:Message):Promise<string/*userId*/> {
  logger.debug(`Maybe create an user`);
  let c = m.from();
  let uid = HsyUtil.getUserIdFromName(c.name());
  let q = new LoopbackQuerier();
  let user = await q.getHsyUserByUid(uid);
  if (!c.weixin()) {
    c = await c.refresh();
  }
  logger.debug(`Got user of uid:${uid}: ${JSON.stringify(user)}`);
  if (user === null || user === undefined) {
    user = new HsyUser();
    user.id = uid;
    user.name = c.name();
    user.created = new Date();
    user.weixin = c.weixin();
    logger.debug(`User of uid:${uid} does not exist, creating a user...`);
  } else {
    logger.debug(`User of uid:${uid} already existed`);
  }
  // TODO(zzn): avatar is currently empty file
  // user.avatarId = await savePic('tmp/img/' + c.name() + '.jpg', await c.avatar());
  user.lastUpdated = new Date();
  await q.setHsyUser(user);
  logger.debug(`User of uid:${uid} created/updated: ${JSON.stringify(user)}`);
  return uid;
};
