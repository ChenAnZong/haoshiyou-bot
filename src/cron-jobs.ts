import {LoopbackQuerier} from './loopback-querier';
import {HsyUtil} from './hsy-util';
import Logger from 'log4ts/build/Logger';
import {HsyListing} from '../loopbacksdk/models/HsyListing';
import {getStringFromHsyGroupEnum} from './global';
const reportRecentListingsToGroup = async function() {
  const logger = Logger.getLogger(`cronjob-reportRecentListingsToGroup`);
  let lq:LoopbackQuerier = new LoopbackQuerier();
  try {
    let allRentalGroups = await HsyUtil.findAllRentalHsyGroups();
    for (let group of allRentalGroups) {
        let hsyGroupEnum = HsyUtil.getHsyGroupEnum(group.topic());
        let lists = await lq.getLatestSomeHsyListing(hsyGroupEnum, 5);
        let msg = `亲爱的${getStringFromHsyGroupEnum(hsyGroupEnum)}群友们，本群最新的帖子如下:\n`;
        msg += lists.map((listing:HsyListing) => {
          let picIndicator = listing.imageIds.length > 0 ? `[${listing.imageIds.length}图]` : '';
          return `  ${listing.lastUpdated.toString().slice(0, 10)}${picIndicator}: ${listing.title}: ${HsyUtil.getLinkByHsyListingUid(listing.uid)}&utm_campaign=cron`
        }).join('\n');
        msg += `\n\n\n更多帖子尽在 ${HsyUtil.getLinkByHsyGroupEnum(hsyGroupEnum)}&utm_campaign=cron`;
        await group.say(msg);
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