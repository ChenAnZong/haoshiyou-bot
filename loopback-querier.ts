import {HsyListing} from "./loopbacksdk/models/HsyListing";
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
export class LoopbackQuerier {
  public async getHsyListingByUid(uid:string):Promise<HsyListing> {
    console.log('Connect to LoopBack Server');
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
    return result;
  }

  public static async mainSet() {
    let listing = new HsyListing();
    listing.ownerId = 'some_ownerId_1';
    listing.uid = 'some_uid_1';
    listing.title = 'some title';
    listing.content = 'some content';
    listing.lastUpdated = new Date();
    let q:LoopbackQuerier = new LoopbackQuerier();
    await q.setHsyListing(listing);
  }

  public static async mainGet() {
    let q:LoopbackQuerier = new LoopbackQuerier();
    let listing =  await q.getHsyListingByUid('group-collected-' + '周载南');
    console.log(`got Listing = ${JSON.stringify(listing)}`);
  }
}
