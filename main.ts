import {Wechaty, Room, Contact} from "wechaty";
import {HsyBotLogger} from "./logger";
import {FriendRequest} from "wechaty/dist/src/friend-request";

console.log('XXX DEBUG Start v 3!');

const bot = Wechaty.instance();
const groupDownSizeTarget = 480;
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
    `详情请私信群主周载南(wechat:xinbenlv)或者入口群的管理员们`;
bot
    .on('scan', (url, code) => {
      HsyBotLogger.logDebug(`Please scan the QR code for URL ${url}.`);
      let loginUrl = url.replace('qrcode', 'l');
      require('qrcode-terminal').generate(loginUrl);

      // console.log(url);
      // console.log(`code = ${code}`);
    })

    .on('login', user => {
      HsyBotLogger.logDebug(`${user} logged in`);
    })

    .on('logout', user => {
      HsyBotLogger.logDebug(`${user} logged out.`);
    })

    .on('friend', async function (contact, request:FriendRequest) {
      HsyBotLogger.logFriendRequest(request);
      if (request) {  // 1. request to be friend from new contact
        request.accept();
        contact.say(hsyGreetingsMsg);
      } else {        // 2. confirm friend ship
        // console.log('new friend ship confirmed with ' + contact);
      }
    })

    .on('message', async function (m) {
      HsyBotLogger.logRawChatMsg(m);
      const contact = m.from();
      const content = m.content();
      const room = m.room();
      if (m.self()) {
        return; // Early return for talking to myself.
      }

      function maybeDownsizeKeyRoom(keyroom: Room) {
        // keyroom.memberList().forEach((c:Contact) => console.log(c['rawObj']['DisplayName'] || `无法找到群昵称,用户名称为${c.name()}`));
        if (keyroom.memberList().length >= groupDownSizeTarget) {
          keyroom.say(
              `亲爱的各位好室友租房群的群友们，现在群快满了，清理一批群友给新朋友们腾位置。\n` +
              `我们主要清理两类朋友：\n` +
              `  1. 没有按照改群昵称的朋友，如果你的群昵称不是以'招'、'求'、'介'开头，那么你可能会被优先清理；` +
              `  2. 如果你的入群时间比较长，那么我们会请你优先离群，把空位流动起来（可以重新回来）；` +
              `若仍有需求，欢迎私信好室友小助手（微信号：haoshiyou-admin）重新加群哈~`);
          let potentialRotationList = [];
          let noGroupNickNames = [];
          let cList:Contact[] = keyroom.memberList();
          let shouldRemoveSize = cList.length - groupDownSizeTarget;
          let shouldRemoveList = [];
          for (let i = 0; i < keyroom.memberList().length - 30/*never remove last 30 users*/; i++) {
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
          shouldRemoveList.forEach((c:Contact) => {
            console.log(`INFO Deleting contact ${c.name()} from group ${keyroom.topic()}`);
            keyroom.del(c); // a promise, but we won't wait.
          });
        } else {
          console.log(`Group Size of ${keyroom.topic()} is ` +
              `still good (${keyroom.memberList().length}).`)
        }
      }

      if (m.rawObj['MMIsChatRoom'] == false || /好室友.*入口群/.test(m.room().topic())) { // only to me or entry group
        console.log('Talking to 好室友 admin');
        let groupToAdd = null;

        if (/南湾西|Mountain View|mtv|sv|Sunnyvale|Palo Alto|Stanford|Facebook|Google/.test(content)) {
          groupToAdd = "南湾西";
        } else if (/南湾东|Milpitas|San Jose|Santa Clara/.test(content)) {
          groupToAdd = "南湾东";
        } else if (/东湾|奥克兰|伯克利/.test(content)) {
          groupToAdd = "东湾";
        } else if (/(中)半岛/.test(content)) {
          groupToAdd = "中半岛";
        } else if (/旧金山|三番|San Francisco/.test(content)) {
          groupToAdd = "三番";
        } else if (/短租/.test(content)) {
          groupToAdd = "短租";
        } else if (/testbotgroup/.test(content)) {
          groupToAdd = "testgroup"
        }

        if (groupToAdd == null) { // found no valid group
          m.say(hsyGreetingsMsg);
        } else {
          console.log(`Start to add ${contact} to room ${groupToAdd}.`);
          m.say(`好的，你要加${groupToAdd}的群对吧，我这就拉你进群。`);
          let typeRegEx = new RegExp(`好室友.*` + groupToAdd);
          let keyroom = await Room.find({topic: typeRegEx});
          if (keyroom) {
            await keyroom.add(contact);
            maybeDownsizeKeyRoom(keyroom);
            await m.say("欢迎欢迎，", contact);
          } else {
            m.say(`囧...加群失败，请联系群主周载南(微信号:xinbenlv)。`);
            console.log(`Didn't found ${groupToAdd}.`);
          }
        }
      }

    })

    .init();
