import {Contact} from "wechaty/dist/src/contact";
import {Room} from "wechaty/dist/src/room";
exports = module.exports = async function onRoomTopic(
    room: Room, topic: string, oldTopic: string, changer: Contact) {
  console.log('On RoomTopic Event!');
  console.log(`Room ${room.topic()} topic changed from ${oldTopic} ` +
      `to ${topic} by ${changer.name()}`);
};
