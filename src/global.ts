// Used as a global variable
import {HsyGroupEnum} from "./model";
export let GLOBAL_blackListCandidates = {
    // 'adminRemark': { time: unixTime, candidates: [blacklistUser1, blacklistUser2]}
};

// TODO(zzn): use a BiMap instead
export const GROUP_DICT = {
    "三番":HsyGroupEnum.SanFrancisco,
    "南湾西":HsyGroupEnum.SouthBayWest,
    "南湾东":HsyGroupEnum.SouthBayEast,
    "东湾":HsyGroupEnum.EastBay,
    "中半岛":HsyGroupEnum.MidPeninsula,
    "西雅图":HsyGroupEnum.Seattle,
    "短租":HsyGroupEnum.ShortTerm,
    "测试":HsyGroupEnum.TestGroup,
    "老友":HsyGroupEnum.OldFriends,
    "大军团": HsyGroupEnum.BigTeam
};

export const ALL_HSY_GROUP_ENUMS:Array<any> = [
    HsyGroupEnum.SanFrancisco,
    HsyGroupEnum.SouthBayWest,
    HsyGroupEnum.SouthBayEast,
    HsyGroupEnum.EastBay,
    HsyGroupEnum.MidPeninsula,
    HsyGroupEnum.Seattle,
    HsyGroupEnum.ShortTerm,
    HsyGroupEnum.TestGroup,
    HsyGroupEnum.OldFriends,
    HsyGroupEnum.BigTeam
];

export let getStringFromHsyGroupEnum = function(input:HsyGroupEnum):string {
  for (let key in GROUP_DICT) {
    if (GROUP_DICT[key] == input) return key;
  }
  return null;
};

export const hsyReferMsg = `
另外，用户在我们系列微信群里发布的招租求租信息将自动同时发布到我们的网站和app。
欢迎尝试：
  网站: http://haoshiyou.org/?referrer=hsybot-private
`;

export const greetingsMsg =
    `你好，谢谢你加我们群，请问你要在哪个区域找房子或者室友？\n` +
    `我们是按照区域分群的。我拉你入群：\n` +
    `  【南湾西】包含 Palo Alto，Stanford, Mountain View，Sunnyvale，Cupertino 一带；\n` +
    `  【南湾东】包含 San Jose，Santa Clara，Milpitas一带；\n` +
    `  【东湾】湾东边 Milpitas以北，包括Fremont，Hayward，Berkeley等；\n` +
    `  【中半岛】Redwood以北，San Francisco以南；\n` +
    `  【三番】旧金山 (San Francisco) 城里，含South San Francisco；\n`+
    `  【西雅图】我们新开设了西雅图好室友群，服务大西雅图地区；\n`+
    `  【短租】如果你希望在旧金山湾区任意地方内进行3个月以内短租（出租和求租），请加短租群；\n`+
    `请回复要加哪个群，例如： 南湾西\n` +
    `另外如果你在我们群里找到了室友或者房子，欢迎加入我们的【好室友】"老友群"，闲聊~，` +
    `详情请私信群主周载南(wechat:xinbenlv)或者入口群里的管理员们`;


export const hsyCannotUnderstandMsg = `哎呀，小助手没听懂你说啥意思哈，回复【加群】了解怎样加入租房群。`;

export const hysAlreadyAddedMsg = `已邀请，请点击加入[湾区好室友]系列租房群。`;

export const hsyGroupNickNameMsg = `
 
请大家把昵称改为如下格式：“招/求/-地点-时间-真全名”，例如:
 
“招-mtv-5/1-王小明”表示你是王小明，招租房客，房子地点在 Mountain View，时间5月1日开始。 
“求-pa-4/12-韩梅梅”表示你是韩梅梅，求租房子，房子地点在 Palo Alto，时间4月1日开始。 
“介-李雷”表示你是李雷，在群里目前没有需求，仅为了介绍朋友进群。“介”这类可以不写时间地点。
本群中对地点常用缩写约定如下：

  SF - San Francisco, PA - Palo Alto,  
  MTV - Mountain View,  
  SV - Sunnyvale,  
  FMNT - Fremont,  
  SJ - San Jose,
  MPTS - Milpitas,
  BKL - Berkeley
  SEA - Seattle
  KIR - Kirkland

好室友系列租房群会自动定期清理没有修改群昵称的群友，以及最早的群友以便给新人腾位置。
如果你被清理出去了也别担心，随时加好室友小助手(WeChat:haoshiyou-admin)。`;

export const hsyGroupClearMsg = `亲爱的各位好室友租房群的群友们，现在群快满了，清理一批群友给新朋友们腾位置。
我们主要清理两类朋友：
1. 没有按照改群昵称的朋友，如果你的群昵称不是以'招'、'求'、'介'开头，那么你可能会被优先清理；
2. 如果你的入群时间比较长，那么我们会请你优先离群，把空位流动起来（可以重新回来）；
若仍有需求，欢迎私信好室友小助手（微信号：haoshiyou-admin）重新加群哈~\n
` + hsyReferMsg;
