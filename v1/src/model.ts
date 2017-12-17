
/**
 * Please never reuse enum ids, since things here goes into logs.
 *
 * NextId = 7;
 */
export enum HsyGroupEnum {
  None = -1,
  TestGroup = 0,
  SouthBayEast = 1,
  SouthBayWest = 2,
  EastBay = 3,
  SanFrancisco = 4,
  MidPeninsula = 5,
  ShortTerm = 6,
  OldFriends = 7,
  Seattle = 8,
  BigTeam = 9,
}

/**
 * Please never reuse enum ids, since things here goes into logs.
 *
 * NextId = 2;
 */
export enum HsyListingTypeEnum {
  NeedRoommate = 0,
  NeedRoom = 1,
}

/**
 * Please never reuse enum ids, since things here goes into logs.
 *
 * NextId = 5;
 */
export enum HsyBotLoggerType {
  debugInfo = 1,
  chatEvent = 2,
  friendRequestEvent = 3,
  botAddToGroupEvent = 4
}
