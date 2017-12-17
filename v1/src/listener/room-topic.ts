import {Contact} from "wechaty/dist/src/contact";
import {Room} from "wechaty/dist/src/room";
import { Logger, LoggerConfig } from "log4ts";

const logger = Logger.getLogger(`room-topic`);

exports = module.exports = async function onRoomTopic(
    room: Room, topic: string, oldTopic: string, changer: Contact) {
  logger.trace('On RoomTopic Event!');
  logger.debug(`Room ${room.topic()} topic changed from ${oldTopic} ` +
      `to ${topic} by ${changer.name()}`);
};
