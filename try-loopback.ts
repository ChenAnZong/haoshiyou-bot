import {HsyListing} from "./loopbacksdk/models/HsyListing";
let config = {
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

console.log('Connect to LoopBack Server');
let request = require('request');
let promise = require('bluebird');
let purest = require('purest')({request, promise});
let loopback = purest({provider: 'loopback', config});

let req = loopback
    .get('HsyListings')
    .request();

req
    .catch((err) => {
      console.log(JSON.stringify(err));
    })
    .then((result) => {
      let listings:HsyListing[] = result[0].body;
      console.log(JSON.stringify(listings));
    });

let listing = new HsyListing();
listing.ownerId = 'some_ownerId';
listing.uid = 'some_uid';
listing.title = 'some title';
listing.content = 'some content';
listing.lastUpdated = new Date();


