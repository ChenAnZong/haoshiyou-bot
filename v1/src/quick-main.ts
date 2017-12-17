import {LoopbackQuerier} from './loopback-querier';
import {HsyGroupEnum} from './model';
import {HsyListing} from '../loopbacksdk/models/HsyListing';

(async function() {
  console.log(`start!!!`);

  let lq:LoopbackQuerier = new LoopbackQuerier();
  console.log(`before getting!!!`);
  let lists:HsyListing[] = await lq.getLatestSomeHsyListing(HsyGroupEnum.TestGroup);
  console.log(`lists num = ${lists.length}`);
  console.log(`${lists[0].lastUpdated.toString().slice(0, 10)}`);
})();
