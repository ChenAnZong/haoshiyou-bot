# Haoshiyou-Bot
A chat bot supported on [WeChaty](http://blog.wechaty.io),
managing the HaoShiYou wechat groups run by volunteers of haoshiyou.org

## Quick Start
To start running in a docker

```bash
docker run -ti --volume="$(pwd)":/bot --rm zixia/wechaty main.ts
```

## Roadmap

* Basic function 
  - [X] Auto-accept Friend Request
  - [X] Detect user group-join intention to add to a specific group
  - [X] Delete user when groups approach to max member limit - say, 480 members.
      - Never delete group admins (a whitelist).
      - Delete the first 30 members that are not renaming their nick names in the 
        designated format.
      - Delete the first 10 members that was added to the group the earliests.
  - [X] Privately poked group members who haven't update the group nickname.

* Logging
  - [X] Logging chat data for future research.
 
* Integration function
  - [ ] Auto-detect an user is posting a listing of for rent or find home.
  - [ ] Post to Haoshiyou-Server

* Advance function
  - [ ] Extract time, price, type from a list post
  - [ ] Based on conversation session state, etract photos posted followed 
        by the previous post.
  - [ ] Post to Haoshiyou-Server with extracted information, and create account.
