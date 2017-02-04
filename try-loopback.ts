import {HsyListing} from "./loopbacksdk/models/HsyListing";
const config = {
  "loopback": {
    "http://localhost:3000": {
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

class LoopbackQuerier {
  public async getHysListing():Promise<Object> {
    console.log('Connect to LoopBack Server');

    let req = loopback
        .get('HsyListings')
        .request();
    let result = await req
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    let listings:HsyListing[] = result[0].body;
    console.log(JSON.stringify(listings));
    return result;
  }

  public async setHsyListing(listing) {

    let req = loopback.put('HsyListings')
        .json(listing)
        .request();

    let result = await req
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    console.log('Successfully!');
    let listings:HsyListing[] = result[0].body;
    console.log(JSON.stringify(listings));
    return result;
  }

  public static async main() {
    let listing = new HsyListing();
    listing.ownerId = 'some_ownerId_1';
    listing.uid = 'some_uid_1';
    listing.title = 'some title';
    listing.content = 'some content';
    listing.lastUpdated = new Date();
    let q:LoopbackQuerier = new LoopbackQuerier();
    await q.setHsyListing(listing);
  }
}

LoopbackQuerier.main();

