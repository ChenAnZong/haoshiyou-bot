
import { Logger, LoggerConfig } from "log4ts";
import {Room} from "wechaty";
import {GROUP_DICT, Global_allManagedGroups} from "../global";
const logger = Logger.getLogger(`main`);

exports = module.exports = async function onLogin(user) {

  let registerAllManagedGroups = async function() {
    logger.info(`Start registering all rooms(groups)`);
    for(let key in GROUP_DICT) {
      let enumValue = GROUP_DICT[key];
      let typeRegEx = new RegExp(`【好室友】` + key);

      logger.info(`Looking for room room ${typeRegEx}...`);
      let room = await Room.find({topic: typeRegEx});
      Global_allManagedGroups[enumValue] =  room;
      logger.info(`Registering room ${room.topic()}...`);
    }
  };


  await logger.info(`${user} logged in`);
  // await waitForLoading();
  // await registerAllManagedGroups();

};
