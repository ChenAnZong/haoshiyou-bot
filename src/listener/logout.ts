import {Contact} from "wechaty/dist/src/contact";
exports = module.exports = async function onLogOut(user:Contact) {
  console.log('On LogOut Event!');
  console.log(`user ${user} logout`)
};
