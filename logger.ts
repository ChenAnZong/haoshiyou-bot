import {Message, Contact} from "wechaty";
import {FriendRequest} from "wechaty/dist/src/friend-request";

const file = 'log.json';
console.log('XXX LOG START 1');
let jsonfile = require('jsonfile');

class HsyBotLogObject {
  public type: HsyBotLoggerType;
  public rawChatMessage:Message; // for logging the original messsage
  public friendRequestFrom:Contact; // for logging the Friend Request
  public friendRequestMessage:string;
  public debugMessage:string;
  public timestamp:Date;
  constructor() {
    this.timestamp = new Date();
  }
}

export enum HsyGroupEnum {
  SouthBayEast = 1,
  SouthBayWest = 2,
  EastBay = 3,
  SanFrancisco = 4,
  MidPeninsula = 5,
}
export enum HsyBotLoggerType {
  debugInfo = 1,
  chatEvent = 2,
  friendRequestEvent = 3,
  botAddToGroupEvent = 4
}

export class HsyBotLogger {
  public static logFriendRequest(requestMessage:FriendRequest):void {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.friendRequestEvent;
    logItem.friendRequestFrom = requestMessage.contact;
    logItem.friendRequestMessage = requestMessage.hello;
    HsyBotLogger.log(logItem);
  }

  public static logRawChatMsg(message: Message):void {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.chatEvent;
    logItem.rawChatMessage = message;
    HsyBotLogger.log(logItem);
  }

  private static log(logItem:HsyBotLogObject):void {
    console.log(`XXX DEBUG LOG ${JSON.stringify(logItem)}`);
    jsonfile.writeFileSync(file, logItem, {flag: 'a'});
  }

  public static logDebug(str:string):void {
    let logItem = new HsyBotLogObject();
    logItem.type = HsyBotLoggerType.debugInfo;
    logItem.debugMessage = str;
    this.log(logItem);
  }
}
