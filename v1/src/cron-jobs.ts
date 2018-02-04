import {HsyUtil} from './hsy-util';
import Logger from 'log4ts/build/Logger';
import {ALL_RENTAL_HSY_GROUP_ENUMS} from './global';

const reportRecentListingsToGroup = async function() {
  const logger = Logger.getLogger(`cronjob-reportRecentListingsToGroup`);
  try {
    for (let hsyGroupEnum of ALL_RENTAL_HSY_GROUP_ENUMS) {
      let msg = await HsyUtil.generateMsgByHsyGroupEnum(hsyGroupEnum);
      let group = await HsyUtil.findHsyRoomByEnum(hsyGroupEnum);
      if (!process.env.FULL_FEATURE) await group.say(msg);
      logger.debug(`Says the following to ${group.topic()}:\n` + msg);
    }

  } catch (e) {
    logger.warn(e);
  }
};

const reportToGoogleAnalytics= async function() {
  const ua = require('universal-analytics');
  const visitor = ua('UA-55311687-5', 'haoshiyou-bot-uuid'); // Google Analytics > haoshiyou.org > Haoshiyou-bot
  const logger = Logger.getLogger(`cronjob-reportToGoogleAnaltycs`);
  try {
    logger.trace(`Tick 15000ms`);
    let allRentalGroups = await HsyUtil.findAllRentalHsyGroups();
    let buffer = "Group List: \n";
    for (let group of allRentalGroups) {
      buffer += `  Group ${group.topic()} Member Size ${group.memberList().length}\n`;
      visitor.event("haoshiyou-bot", `group-size`, group.topic(), group.memberList().length, function (err) {
        if (err) logger.warn(`Google Analytics failed due to ${err}`);
      });
    }
    logger.debug(buffer);


  } catch (e) {
    logger.warn(e);
  }
};

export default class CronJobs {
  public static setCronJobs = function() {
    const jobList = [
      {
        jobFunc: reportToGoogleAnalytics,
        intervalInSeconds: 15
      },
      {
        jobFunc: reportRecentListingsToGroup,
        intervalInSeconds: 3600 * 12 // each 12 Hours
      },
    ];
    const logger = Logger.getLogger(`CronJobs`);
    jobList.forEach(job => {
      setInterval(job.jobFunc, job.intervalInSeconds * 1000);
      logger.info(`Setup ${job.jobFunc.name} to run every ${job.intervalInSeconds} seconds`);
    });
  };
}