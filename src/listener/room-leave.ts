import { Logger, LoggerConfig } from "log4ts";
import {Contact, Room} from "wechaty";
const logger = Logger.getLogger(`main`);

exports = module.exports = async function onRoomLeave(room:Room, leaverList: Contact[]) {
  logger.info(`the room ${room.topic()}, ${leaverList} left the room`);
};
