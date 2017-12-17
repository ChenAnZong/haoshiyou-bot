# Haoshiyou-Bot

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-green.svg)](https://github.com/wechaty/wechaty)

A chat bot supported on [WeChaty](http://blog.wechaty.io),
managing the HaoShiYou wechat groups run by volunteers of haoshiyou.org

## Quick Start
To start running in a docker

```bash
docker run --env CLOUDINARY_SECRET=$CLOUDINARY_SECRET -ti --volume="$(pwd)":/bot --rm zixia/wechaty src/main.ts
```

## Update Docker
```bash
brew unlink yarn
brew install yarn
docker pull zixia/wechaty
```

Query server link

`http://haoshiyou-server-dev.herokuapp.com/api/HsyListings?filter={%22where%22:%20{%22uid%22:%22group-collected-%E5%91%A8%E8%BD%BD%E5%8D%97%22}}`

Or http://haoshiyou-server-dev.herokuapp.com/api/HsyListings?filter={%22where%22:%20{%22uid%22:%22group-collected-%E5%91%A8%E8%BD%BD%E5%8D%97%22}}
 
 
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
  - [P] Automatically delete friends if approaching 5000 friends cap. 
      **Postponed:** current version of web client does not support deleting, so we can't do it


* Logging
  - [X] Logging chat data for future research.
 
* Integration function
  - [X] Auto-detect an user is posting a listing of for rent or find home.
  - [X] Append all pictures to the listing 
  - [X] Add information about area and type
  - [X] Post to Haoshiyou-Server
  - [ ] Store Contact's Avatar, stably
  - [ ] Design some admin's commandline

* Advance function
  - [ ] Extract time, price, type from a list post
  - [ ] Based on conversation session state, extract photos posted followed 
        by the previous post.
  - [ ] Post to Haoshiyou-Server with extracted information, and create account.

* Management Function
  - [X] Kick a group member if received kicking instruction from a group and add blacklist
  - [X] Honor black list in the remarks
  - [X] Whoever is trying to invite a blacklisted user will be blacklisted and kickout as weel

* Productivity
  - [X] Hot reload typescript
  - [X] Refactor the code to split each event handler into a separate file

