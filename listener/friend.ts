
import { Logger, LoggerConfig } from "log4ts";
import {HsyBotLogger} from "../datastore";
import {greetingsMsg} from "../global";

const logger = Logger.getLogger(`main`);

exports = module.exports = async function onFriend(contact, request) {
  await HsyBotLogger.logFriendRequest(request);
  if (request) {  // 1. request to be friend from new contact
    await request.accept();
    await contact.say(greetingsMsg);
  } else {        // 2. confirm friend ship
    await logger.info('new friend ship confirmed with ' + contact);
  }
};
