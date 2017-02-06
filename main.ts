import {Wechaty, Room, Contact, Message, FriendRequest} from "wechaty";
import {HsyBotLogger, HsyGroupEnum} from "./logger";

console.log(`--- HsyBot Starts! ---`);

const bot = Wechaty.instance();
const newComerSize = 200;
const groupDownSizeTarget = 465;
const groupDownSizeTriggerThreshold = 480;
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

bot
    .on('scan', async (url, code) => {
      await HsyBotLogger.logDebug(`Please scan the QR code for URL ${url}.`);
      let loginUrl = url.replace('qrcode', 'l');
      require('qrcode-terminal').generate(loginUrl);
    })

    .on('login', async user => {
      await HsyBotLogger.logDebug(`${user} logged in`);
    })

    .on('logout', async user => {
      await HsyBotLogger.logDebug(`${user} logged out.`);
    })

    .on('friend', async (contact, request:FriendRequest) => {
      await HsyBotLogger.logFriendRequest(request);
      if (request) {  // 1. request to be friend from new contact
        await request.accept();
        await contact.say(hsyGreetingsMsg);
      } else {        // 2. confirm friend ship
        await HsyBotLogger.logDebug('new friend ship confirmed with ' + contact);
      }
    })

    .on('message', async (m) => {
      await HsyBotLogger.logRawChatMsg(m);

      if (m.self()) {
        return; // Early return for talking to myself.
      }
      await maybeAddToHsyGroups(m);
      await extractPostingMessage(m);
    })

    .init()
    .then(async _ => await HsyBotLogger.logDebug(`HsyBot is terminated`))
    .catch(async e => await HsyBotLogger.logDebug(e));

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
        console.log(`略过管理员 ${c.name()}, 群里叫做 ${getGroupNickNameFromContact(c)}，备注${c.remark()}`);
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
    console.log(`Group Size of ${keyroom.topic()} is ` +
        `still good (${keyroom.memberList().length}).`)
  }
};

let maybeAddToHsyGroups = async function(m:Message) {
  const contact = m.from();
  const content = m.content();
  const room = m.room();
  let groupType:HsyGroupEnum;
  // only to me or entry group
  if (isTalkingToMePrivately(m) || /好室友.*入口群/.test(m.room().topic())) {
    HsyBotLogger.logDebug('Talking to 好室友 admin');
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
    } else if (/testbotgroup/.test(content)) {
      groupToAdd = "testgroup";
      groupType = HsyGroupEnum.TestGroup;
    } else if (/老友/.test(content)) {
      groupToAdd = "老友";
      groupType = HsyGroupEnum.OldFriends;
    }
    if (groupToAdd == null) { // found no valid group
      await m.say(hsyCannotUnderstandMsg);
    } else {
      await HsyBotLogger.logDebug(`Start to add ${contact} to room ${groupToAdd}.`);
      await HsyBotLogger.logBotAddToGroupEvent(contact, groupType);
      await m.say(`好的，你要加${groupToAdd}的群对吧，我这就拉你进群。`);
      let typeRegEx = new RegExp(`好室友.*` + groupToAdd);
      let keyroom = await Room.find({topic: typeRegEx});
      if (keyroom) {
        await maybeDownsizeKeyRoom(keyroom, contact);
        await keyroom.add(contact);
        await contact.say(hysAlreadyAddedMsg);
        await contact.say(hsyGroupNickNameMsg);

      } else {
        await m.say(`囧...加群失败，请联系群主周载南(微信号:xinbenlv)。`);
        HsyBotLogger.logDebug(`Can't find group ${groupToAdd}`);
      }
    }
  }

};

let isTalkingToMePrivately = function(m:Message) {
  return m.rawObj['MMIsChatRoom'] == false;
};

let extractPostingMessage = async function(m:Message) {
  if (isTalkingToMePrivately(m) || /好室友/.test(m.room().topic())) {
    if (m.content().length >= 80 &&
        /租|rent|roomate|小区|公寓|lease/.test(m.content())) {
      HsyBotLogger.logListing(m, getHsyGroupEnum(m.room()));
    }
  }
};

let getGroupNickNameFromContact = function(c:Contact) {
  return c['rawObj']['DisplayName'];
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
