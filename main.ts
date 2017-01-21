import {Wechaty, Room} from "wechaty";
import {HsyBotLogger} from "./logger";
import {FriendRequest} from "wechaty/dist/src/friend-request";

console.log('XXX DEBUG Start 2!');

const bot = Wechaty.instance();
const hsyGreetingsMsg =
    `你好，谢谢你加我们群，请问你要在哪个区域找房子或者室友？\n` +
    `我们是按照区域分群的。我拉你入群：\n` +
    `  【南湾西】包含Palo Alto，Stanford, Mountain View，Sunnyvale，Cupertino一带；\n` +
    `  【南湾东】包含San Jose，Santa Clara，Milpitas一带；\n` +
    `  【东湾】湾东边Milpitas以北，包括Fremont，Hayward，Berkeley等；\n` +
    `  【中半岛】Redwood以北，San Francisco以南；\n` +
    `  【三番】旧金山(San Francisco)城里，含South San Francisco；\n`+
    `请回复要加哪个群，例如： 南湾西`;
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

      if (m.rawObj['MMIsChatRoom'] == false) { // only to me
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
            console.log(`Added the contact: ${contact}`);
            await m.say("欢迎欢迎，", contact);
          } else {
            m.say(`囧...加群失败，请联系群主周载南(微信号:xinbenlv)。`);
            console.log(`Didn't found ${groupToAdd}.`);
          }
        }
      }

    })

    .init();

let downsizeRoom = async function(room:Room) {
  let contacts = room.memberList();
  console.log(JSON.stringify(contacts));
}
