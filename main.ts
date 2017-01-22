import {Wechaty, Room, Contact, Message, FriendRequest} from "wechaty";
import {HsyBotLogger, HsyGroupEnum} from "./logger";

console.log(`--- HsyBot Starts! ---`);
const bot = Wechaty.instance();
const newComerSize = 100;
const groupDownSizeTarget = 450;
const groupDownSizeTriggerThreshold = 490;
const hsyGreetingsMsg =
    `你好，谢谢你加我们群，请问你要在哪个区域找房子或者室友？\n` +
    `我们是按照区域分群的。我拉你入群：\n` +
    `  【南湾西】包含Palo Alto，Stanford, Mountain View，Sunnyvale，Cupertino一带；\n` +
    `  【南湾东】包含San Jose，Santa Clara，Milpitas一带；\n` +
    `  【东湾】湾东边Milpitas以北，包括Fremont，Hayward，Berkeley等；\n` +
    `  【中半岛】Redwood以北，San Francisco以南；\n` +
    `  【三番】旧金山(San Francisco)城里，含South San Francisco；\n`+
    `  【短租】如果你希望在湾区任意地方内进行3个月以内短租（出租和求租），请加短租群；\n`+
    `请回复要加哪个群，例如： 南湾西\n` +
    `另外如果你在我们群里找到了室友或者房子，欢迎加入我们的【好室友】"老友群"，闲聊~，` +
    `详情请私信群主周载南(wechat:xinbenlv)或者入口群里的管理员们`;

const hsyGroupNickNameMsg =
    `我们的群规是：\n` +
    `  1⃣在群里介绍您的需求。\n`+
    `  2⃣️按要求修改群昵称，格式为“求/招-区域-时间-全真名”，例如 "求-SV-3月-王小明"表示` +
        `你是王小明，求租3月在Sunnyvale附近的房子。` +
        `另外如果你没有立即的需求，可以用"介-张小红"作为群昵称，介字表示你留在群里的主要目的是帮朋友介绍入群，` +
        `我们不会在定期清理中清除介绍类的群友。\n` +
    `  3⃣️已经match的群友可以联系管理员，加入“【好室友】老友群” 本群只发布租求相关信息，严禁发布广告，` +
        `任何其他需求请私信管理员寻求帮助。\n` +
    `  4⃣️【好室友】短租群（流动群），提高效率，会定期移除进群较早和没有按要求修改昵称的朋友，` +
        `如果您尚未match请到haoshiyou.org再次扫描二维码进群，并按要求修改群昵称\n` +
    `  5⃣️本群不为任何群友做背书，请大家本着对自己及他人负责的态度，对信息仔细筛选，` +
        `房屋室友审慎考虑，找人有风险，出租需谨慎.\n` +
    `  6⃣️需要转发、查看信息也可添加“好室友小帮手”ID：haoshiyou-admin;\n` +
    `🈴友情链接：如果你们刚来湾区想要参加各种社交活动拓展社交圈，` +
        `也可以找“九尾萌盟社交平台”添加微信foxinthebay02或者关注公众号：foxinthebay\n` +
    `🈴友情链接：如果您对创业投资感兴趣，欢迎搜索湾区最牛创业组织，` +
        `微信公众平台“硅谷创业者联盟” or 公众号“svace-org”\n`;

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
    })

    .init()
    .then(async _ => await HsyBotLogger.logDebug(`HsyBot is terminated`))
    .catch(async e => await HsyBotLogger.logDebug(e));

let maybeDownsizeKeyRoom = async function(keyroom: Room) {
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
      let groupNickName = c['rawObj']['DisplayName'];
      if (/^(管|介|群主)-/.test(groupNickName)) {
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
    await Promise.all(shouldRemoveList.map(async (c:Contact) => {
      await HsyBotLogger.logDebug(`Deleting contact ${c.name()} from group ${keyroom.topic()}`);
      await c.say(`亲~你在${keyroom.topic()}待着太久了或者还没有按照规则修改群昵称，` +
          `我先把你挪出本群哈，随时加我重新入群`);
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
  if (m.rawObj['MMIsChatRoom'] == false || /好室友.*入口群/.test(m.room().topic())) {
    HsyBotLogger.logDebug('Talking to 好室友 admin');
    let groupToAdd = null;

    if (/南湾西|Mountain View|mtv|sv|Sunnyvale|Palo Alto|Stanford|Facebook|Google|Menlo Park/.test(content)) {
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
    } else if (/短租/.test(content)) {
      groupToAdd = "短租";
      groupType = HsyGroupEnum.MidPeninsula;
    } else if (/testbotgroup/.test(content)) {
      groupToAdd = "testgroup";
      groupType = HsyGroupEnum.TestGroup;
    }
    if (groupToAdd == null) { // found no valid group
      await m.say(hsyGreetingsMsg);
    } else {
      await HsyBotLogger.logDebug(`Start to add ${contact} to room ${groupToAdd}.`);

      await HsyBotLogger.logBotAddToGroupEvent(contact, groupType);
      await m.say(`好的，你要加${groupToAdd}的群对吧，我这就拉你进群。`);
      let typeRegEx = new RegExp(`好室友.*` + groupToAdd);
      let keyroom = await Room.find({topic: typeRegEx});
      if (keyroom) {
        await keyroom.add(contact);
        await maybeDownsizeKeyRoom(keyroom);
        await contact.say("已加，欢迎加入湾区【好室友】系列租房群。");
        await contact.say(hsyGroupNickNameMsg);

      } else {
        await m.say(`囧...加群失败，请联系群主周载南(微信号:xinbenlv)。`);
        HsyBotLogger.logDebug(`Can't find group ${groupToAdd}`);
      }
    }
  }

};
