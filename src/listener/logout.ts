import {Contact} from "wechaty/dist/src/contact";
import { Logger, LoggerConfig } from "log4ts";

const logger = Logger.getLogger(`logout`);

export default async function onLogOut(user:Contact) {
  logger.trace('On LogOut Event!');
  logger.info(`user ${user} logout`)
};
