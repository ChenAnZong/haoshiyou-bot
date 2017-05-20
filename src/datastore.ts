import {Message, Contact} from "wechaty";
import {FriendRequest} from "wechaty/dist/src/friend-request";
import {HsyListing} from "../loopbacksdk/models/HsyListing";
import {LoopbackQuerier} from "./loopback-querier";
import { Logger, LoggerConfig } from "log4ts";
import {HsyUtil} from "./hsy-util";
import {HsyBotLoggerType, HsyGroupEnum, HsyListingTypeEnum} from "./model";
import {getStringFromHsyGroupEnum} from "./global";

const file = 'log.json';
const fileListings = 'potential-posting.json';
const jsonfile = require('jsonfile');
const util = require('util');
class HsyBotLogObject {
  public type: HsyBotLoggerType;
  public contact:Contact;
  public groupEnum:HsyGroupEnum;
  public rawChatMessage:Message; // for logging the original message
  public friendRequestMessage:string;
  public debugMessage:string;
  public timestamp:Date;
  constructor() {
    this.timestamp = new Date();
  }
}


export class HsyBotLogger {
  private static lq:LoopbackQuerier = new LoopbackQuerier();
  public static logger = Logger.getLogger(`HsyBotLogger`);
  public static async logBotAddToGroupEvent(
      contact:Contact,
      groupEnum:HsyGroupEnum):Promise<void> {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.botAddToGroupEvent;
    logItem.groupEnum = groupEnum;
    logItem.contact = contact;
    await HsyBotLogger.log(logItem);
  }
  public static async logFriendRequest(requestMessage:FriendRequest):Promise<void> {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.friendRequestEvent;
    logItem.contact = requestMessage.contact;
    logItem.friendRequestMessage = requestMessage.hello;
    await HsyBotLogger.log(logItem);
  }

  public static async logRawChatMsg(message: Message):Promise<void> {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.chatEvent;
    logItem.rawChatMessage = message;
    await HsyBotLogger.log(logItem);
  }

  private static async log(logItem:HsyBotLogObject):Promise<void> {
    let inspectedLogItem = util.inspect(logItem);
    let msg = `${JSON.stringify(inspectedLogItem)}`;
    this.logger.trace(msg);
    await jsonfile.writeFileSync(file, inspectedLogItem, {flag: 'a'});
  }

  public static async logDebug(str:string):Promise<void> {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.debugInfo;
    logItem.debugMessage = str;
    await this.log(logItem);
  }

  public static async logListing(m:Message, hsyGroupEnum:HsyGroupEnum):Promise<string/*uid*/> {
    let c:Contact = m.from();
    let listing = {
      contact: c.name(),
      groupNickName: c['rawObj']['DisplayName'],
      content: m.content()
    };

    let cleanContent = HsyUtil.extractCleanContent(m.content());
    let hsyListing:HsyListing = new HsyListing();
    hsyListing.ownerId = HsyUtil.getHsyUserIdFromName(c.name());
    hsyListing.lastUpdated = new Date();
    hsyListing.uid = HsyUtil.getHsyUserIdFromName(c.name());
    hsyListing.content = cleanContent;
    hsyListing.listingTypeEnum = HsyListingTypeEnum[
        /求租/.test(m.content()) ? HsyListingTypeEnum.NeedRoom : HsyListingTypeEnum.NeedRoommate
    ];
    hsyListing.type = hsyListing.listingTypeEnum
        == HsyListingTypeEnum[HsyListingTypeEnum.NeedRoom] ? 1 : 0;
    hsyListing.title = cleanContent.slice(0, 25);
    hsyListing.hsyGroupEnum = HsyGroupEnum[hsyGroupEnum];
    hsyListing.wechatId = m.from().weixin();
    await HsyBotLogger.lq.setHsyListing(hsyListing);
    HsyBotLogger.logger.debug(`Successfully stored ${JSON.stringify(hsyListing)}`);
    await jsonfile.writeFileSync(fileListings, listing, {flag: 'a'});
    return hsyListing.uid;
  }

  public static async logListingImage(
      m:Message, hsyGroupEnum:HsyGroupEnum, imagePublicId:string):Promise<string/*uid*/> {
    let c:Contact = m.from();
    let uid = HsyUtil.getHsyUserIdFromName(c.name());
    let hsyListing:HsyListing = await HsyBotLogger.lq.getHsyListingByUid(uid);
    if (hsyListing === undefined || hsyListing === null) {
      let content = `${getStringFromHsyGroupEnum(hsyGroupEnum)}招租，详情见图片`;
      // create new listing
      hsyListing = new HsyListing();
      hsyListing.ownerId = HsyUtil.getHsyUserIdFromName(c.name());
      hsyListing.uid = uid;
      hsyListing.listingTypeEnum = HsyListingTypeEnum[HsyListingTypeEnum.NeedRoommate];
      hsyListing.type = hsyListing.listingTypeEnum
          == HsyListingTypeEnum[HsyListingTypeEnum.NeedRoom] ? 1 : 0;
      hsyListing.title = content;
      hsyListing.content = content;
      hsyListing.hsyGroupEnum = HsyGroupEnum[hsyGroupEnum];
      hsyListing.wechatId = m.from().weixin();
      hsyListing.imageIds = [imagePublicId];
    } else {
      hsyListing.imageIds = hsyListing.imageIds.concat(imagePublicId);
    }
    hsyListing.lastUpdated = new Date();

    HsyBotLogger.logger.debug(`Updating image ${imagePublicId} for contact ${uid}`);
    let updatedHsyListing = await HsyBotLogger.lq.setHsyListing(hsyListing);

    HsyBotLogger.logger.debug(`Done updating image ${imagePublicId} for contact ${uid}`);
    HsyBotLogger.logger.debug(`updatedHsyListing = ${JSON.stringify(updatedHsyListing)}`);
    return hsyListing.uid;
  }
}
