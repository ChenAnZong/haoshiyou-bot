
import { Logger, LoggerConfig } from "log4ts";
import {greetingsMsg} from "../global";
import {Contact} from "wechaty";
import {HsyUtil} from "../hsy-util";
import {HsyBotLogger} from "../datastore";

const logger = Logger.getLogger(`friend`);

exports = module.exports = async function onFriend(contact:Contact, request) {
  if (request) {  // 1. request to be friend from new contact
    await HsyBotLogger.logFriendRequest(request);
    await request.accept();
    await contact.say(greetingsMsg);
    let contactList = await Contact.findAll();
    if ((contactList.length > 4000 && contactList.length % 5 == 0)
        || (contactList.length > 4900 && contactList.length % 2 == 0)
        || (contactList.length > 4950)) {
      let bigTeamRoom = await HsyUtil.findHsyBigTeamRoom();
      await bigTeamRoom.say(`报告~，刚添加新朋友${contact.name()}，好室友小助手的好友数量已达到${contactList.length}`);
    } else {
      logger.info(`Added a new friend, current friend number ${contactList.length}.`);
    }
  } else {        // 2. confirm friend ship
    await logger.info('new friend ship confirmed with ' + contact);
  }
};
