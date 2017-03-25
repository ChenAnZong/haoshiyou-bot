import {HsyListing} from "../loopbacksdk/models/HsyListing";
import {HsyUser} from "../loopbacksdk/models/HsyUser";
import {HsyUtil} from "./hsy-util";
const config = {
  "loopback": {
    "http://haoshiyou-server-dev.herokuapp.com": {
      "__domain": {
        "auth": {
          "auth": {"bearer": "[0]"}
        }
      },
      "api/{endpoint}": {
        "__path": {
          "alias": "__default",
        }
      }
    }
  },
};
const request = require('request');
const promise = require('bluebird');
const purest = require('purest')({request, promise});
const loopback = purest({provider: 'loopback', config});
// request.debug = true;
export class LoopbackQuerier {
  public async getHsyListingByUid(uid:string):Promise<HsyListing> {
    let req = loopback
        .get('HsyListings')
        .qs({filter:
            JSON.stringify({ 'where':
              {'uid': uid}
            })
        })
        .request();
    let result = await req
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    let listing:HsyListing = result[0].body[0];
    return listing;
  }

  public async setHsyListing(listing) {
    let req = loopback.put('HsyListings')
        .json(listing)
        .request();

    let result = await req
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    let listings:HsyListing[] = result[0].body;
    console.log(JSON.stringify(listings));
    return listings.length > 0 ? listing[0] : null;
  }

  public async getHsyUserByUid(uid:string):Promise<HsyUser> {
    let req = loopback
        .get('HsyUsers')
        .qs({filter:
            JSON.stringify({ 'where':
                {'id': uid}
            })
        })
        .request();
    let result = await req
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    let hsyUsers:HsyUser[] = result[0].body;
    return hsyUsers.length > 0 ? hsyUsers[0]: null;
  }

  public async setHsyUser(user) {
    let req = loopback.put('HsyUsers')
        .json(user)
        .request();

    let result = await req
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    let users:HsyUser[] = result[0].body;
    console.log(JSON.stringify(users));
    return result;
  }

  public static async mainSet() {
    let user = new HsyUser();
    user.id = 'some_ownerId_1';
    user.name = 'some title';
    let q:LoopbackQuerier = new LoopbackQuerier();
    await q.setHsyUser(user);
  }

  public static async mainGet() {
    let q:LoopbackQuerier = new LoopbackQuerier();
    let uid = HsyUtil.getUserIdFromName('周载南');
    let hsyUser = await q.getHsyUserByUid(uid);
    console.log(`Got user of uid:${uid}: ${JSON.stringify(hsyUser)}`);
  }
}

LoopbackQuerier.mainSet();
