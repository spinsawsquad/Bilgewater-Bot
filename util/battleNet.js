const config = require('../config.json');
const blizzard = require('blizzard.js').initialize({ apikey: config.battlenet });
const util = require('util');
const request = require('request');
const cheerio = require('cheerio');

const common = require('..//util//common');
const logging = require('..//util//logging');
const raiderIo = require('..//util//raiderIo');
const warcraftLogs = require('..//util//warcraftLogs');

const armoryUrl = 'https://worldofwarcraft.com/%s/character/%s/%s';
const charRenderUrl = 'https://render-%s.worldofwarcraft.com/character/%s';
exports.iconRenderUrl = 'https://render-%s.worldofwarcraft.com/icons/%d/%s.jpg';

iconSize = 56;
validRegions = ['us', 'eu', 'kr', 'tw'];

// Legion raids
const progressionRaids = [
  {'name': 'The Emerald Nightmare', 'short': 'EN'},
  {'name': 'Trial of Valor', 'short': 'ToV'},
  {'name': 'The Nighthold', 'short': 'NH'},
  {'name': 'Tomb of Sargeras', 'short': 'ToS'},
  {'name': 'Antorus, the Burning Throne', 'short': 'ABT'},
];

// 'Ahead of the Curve' achievement IDs
const aotc = {
  'en': 11194,
  'tov': 11581,
  'nh': 11195,
  'tos': 11874,
  'abt': 12110
};

// 'Cutting Edge' achievement IDs
const ce = {
  'en': 11191,
  'tov': 11580,
  'nh': 11192,
  'tos': 11875,
  'abt': 12111
};

exports.isValidRegion = function(region, message) {
  for (var i = 0; i < validRegions.length; i++) {
    if (validRegions[i].toLowerCase() == region.toLowerCase())
      return true;
  }
  var errorMessage = `invalid region! Valid regions are us, eu, kr, and tw.`;
  message.reply(errorMessage);
  return false;
}

exports.getArmoryUrl = function(character, realm, region) {
  var armoryRegion = 'en-us';
  if(region === 'eu') {
    armoryRegion = 'en-gb';
  } else
  if(region === 'kr') {
    armoryRegion = 'ko-kr';
  } else
  if(region === 'tw') {
    armoryRegion = 'zh-cn';
  }
  var url = util.format(armoryUrl, armoryRegion, realm.replace(' ', '-'), character);
  return url;
}

exports.getIconRenderUrl = function(region, icon) {
  var renderUrl = util.format(exports.iconRenderUrl, region, iconSize, icon)
  return renderUrl;
}

exports.getCharRenderUrl = function(region, imageUrl) {
  var renderUrl = util.format(charRenderUrl, region, imageUrl)
  return renderUrl;
}

exports.getNameAndTitle = function (data) {
  var titles = data.titles;
  var titleSelected = '%s';
  for(i = 0; i < titles.length; i++) {
    if(titles[i].selected) {
      titleSelected = titles[i].name;
      break;
    }
  }
  var nameAndTitle = titleSelected.replace('%s', data.name);
  return nameAndTitle;
}

exports.getFactionEmbedColor = function (faction) {
  var embedColor = 0x004fce; // Blue for Alliance
  if(faction == 1) {
    embedColor = 0xad0505; // Red for Horde
  }
  return embedColor
}

exports.sendCharacterResponse = function (character, realm, region, message) {
  var requestRaiderIo = raiderIo.getRequestUrl(character, realm, region);
  request(requestRaiderIo, { json: true }, (err, res, body) => {
    if (err) {
      var owner = client.users.get(config.ownerID);
      message.channel.send(`Something's not quite right with Raider.IO... Complain to ${owner}`);

      logging.toonLogger.log({
        level: 'Error',
        message: `(battleNet.js:sendCharacterResponse) Request to Raider.IO failed for ${character} ${realm} ${region}: ${err}`
      });
      return;
    }

    var responseRaiderIo = res.body;

    var races = undefined;
    blizzard.wow.data('character-races', { origin: region })
    .then(response => {
      races = response.data.races;

      var classes = undefined;
      blizzard.wow.data('character-classes', { origin: region })
      .then(response => {
        classes = response.data.classes;
      });

      blizzard.wow.character(['profile', 'stats', 'items', 'talents', 'pvp', 'titles', 'achievements', 'progression'], { origin: region, realm: realm, name: character })
      .then(response => {
        var characterImageUrlThumbnail = exports.getCharRenderUrl(region, response.data.thumbnail);
        var characterImageUrlMain = characterImageUrlThumbnail.replace('avatar', 'mainBookmark');
        var characterImageUrlInset = characterImageUrlThumbnail.replace('avatar', 'inset');

        var charLevel = response.data.level;

        var charRace = '';
        for(i = 0; i < races.length; i++) {
          if(races[i].id == response.data.race) {
            charRace = races[i];
            break;
          }
        }

        var charClass = '';
        for(i = 0; i < classes.length; i++) {
          if(classes[i].id == response.data.class) {
            charClass= classes[i];
            break;
          }
        }

        var stats = response.data.stats;
        var items = response.data.items;
        var pvpBrackets = response.data.pvp.brackets;
        var achievementsCompleted = response.data.achievements.achievementsCompleted;

        var embedColor = exports.getFactionEmbedColor(response.data.faction);
        var characterNameTitle = exports.getNameAndTitle(response.data);

        var talents = response.data.talents;
        var currentSpec;
        for(i = 0; i < talents.length; i++) {
          if(talents[i].selected) {
            currentSpec = talents[i];
            break;
          }
        }

        var specRole = currentSpec.spec.role;
        var specIconUrl = exports.getIconRenderUrl(region, currentSpec.spec.icon);

        var versBonus;
        if(specRole === 'DPS'){
          versBonus = stats.versatilityDamageDoneBonus;
        } else
        if(specRole === 'HEALING') {
          versBonus = stats.versatilityHealingDoneBonus;
        } else
        if(specRole === 'TANK') {
          versBonus = stats.versatilityDamageTakenBonus;
        }

        var mainBookmarkStat = 'Intellect';
        var mainBookmarkStatValue = stats.int;
        if(stats.agi > mainBookmarkStatValue) {
          mainBookmarkStat = 'Agility';
          mainBookmarkStatValue = stats.agi;
        }
        if(stats.str > mainBookmarkStatValue) {
          mainBookmarkStat = 'Strength';
          mainBookmarkStatValue = stats.str;
        }

        var mythicPlusSummary = '';
        if (achievementsCompleted.includes(raiderIo.keystoneAchievements.master)) {
          mythicPlusSummary += '\`Keystone Master\`\n';
        } else
        if (achievementsCompleted.includes(raiderIo.keystoneAchievements.conqueror)) {
          mythicPlusSummary += '\`Keystone Conqueror\`\n';
        } else
        if (achievementsCompleted.includes(raiderIo.keystoneAchievements.challanger)) {
          mythicPlusSummary += '\`Keystone Challanger\`\n';
        } else
        if (achievementsCompleted.includes(raiderIo.keystoneAchievements.initiate)) {
          mythicPlusSummary += '\`Keystone Initiate\`\n';
        }

        var scores = responseRaiderIo.mythic_plus_scores;
        var ranks = responseRaiderIo.mythic_plus_ranks;

        if(scores && ranks) {
          var mythicPlusScore = '';
          var mythicPlusRanks = '';
          if(specRole === 'DPS'){
            mythicPlusScore = `**DPS Score:** ${scores.dps.toLocaleString()}\n`;
            mythicPlusRanks = `**${charClass.name} DPS Ranks:** \nRealm - ${ranks.class_dps.realm.toLocaleString()}\nRegion - ${ranks.class_dps.region.toLocaleString()}\nWorld - ${ranks.class_dps.world.toLocaleString()}\n`;
          } else
          if(specRole === 'HEALING') {
            mythicPlusScore = `**Healer Score:** ${scores.healer.toLocaleString()}\n`;
            mythicPlusRanks = `**${charClass.name} Healer Ranks:** \nRealm - ${ranks.class_healer.realm.toLocaleString()}\nRegion - ${ranks.class_dps.region.toLocaleString()}\nWorld - ${ranks.class_healer.world.toLocaleString()}\n`;
          } else
          if(specRole ==='TANK') {
            mythicPlusScore = `**Tank Score:** ${scores.tank.toLocaleString()}\n`;
            mythicPlusRanks = `**${charClass.name} Tank Ranks:** \nRealm - ${ranks.class_tank.realm.toLocaleString()}\nRegion - ${ranks.class_dps.region.toLocaleString()}\nWorld - ${ranks.class_tank.world.toLocaleString()}\n`;
          }
          mythicPlusSummary += mythicPlusScore + mythicPlusRanks;
        }

        var artifactTraits = '0';
        var progressionSummary = ``;
        if (responseRaiderIo.gear) {
          if (responseRaiderIo.gear.artifact_traits) {
            artifactTraits = responseRaiderIo.gear.artifact_traits;
          }
          var raidProgression = response.data.progression.raids;
          if (raidProgression) {
            for (var i = 0; i < progressionRaids.length; i++) {
              if (i != 0)
                progressionSummary += '\n';
              for (var j = 0; j < raidProgression.length; j++) {
                if (raidProgression[j].name == progressionRaids[i].name) {
                  var bosses = raidProgression[j].bosses;
                  var totalBosses = bosses.length;
                  var normalBossesKilled = 0;
                  var heroicBossesKilled = 0;
                  var mythicBossesKilled = 0;
                  for (var k = 0; k < totalBosses; k++) {
                    if (bosses[k].normalKills > 0)
                      normalBossesKilled++;
                    if (bosses[k].heroicKills > 0)
                      heroicBossesKilled++;
                    if (bosses[k].mythicKills > 0)
                      mythicBossesKilled++;
                  }
                  if (mythicBossesKilled > 0) {
                    progressionSummary += `**${progressionRaids[i].short}:** ${mythicBossesKilled}/${totalBosses} M`;
                  }
                  else if (heroicBossesKilled > 0) {
                    progressionSummary += `**${progressionRaids[i].short}:** ${heroicBossesKilled}/${totalBosses} H`;
                  }
                  else {
                    progressionSummary += `**${progressionRaids[i].short}:** ${normalBossesKilled}/${totalBosses} N`;
                  }
                }
              }
              if (progressionRaids[i].short === 'EN') {
                if(achievementsCompleted.includes(ce.en)) {
                  progressionSummary += ' \`CE\`';
                } else
                if (achievementsCompleted.includes(aotc.en)) {
                  progressionSummary += ' \`AOTC\`';
                }
              } else
              if (progressionRaids[i].short === 'ToV') {
                if(achievementsCompleted.includes(ce.tov)) {
                  progressionSummary += ' \`CE\`';
                } else
                if (achievementsCompleted.includes(aotc.tov)) {
                  progressionSummary += ' \`AOTC\`';
                }
              } else
              if (progressionRaids[i].short === 'NH') {
                if(achievementsCompleted.includes(ce.nh)) {
                  progressionSummary += ' \`CE\`';
                } else
                if (achievementsCompleted.includes(aotc.nh)) {
                  progressionSummary += ' \`AOTC\`';
                }
              } else
              if (progressionRaids[i].short === 'ToS') {
                if(achievementsCompleted.includes(ce.tos)) {
                  progressionSummary += ' \`CE\`';
                } else
                if (achievementsCompleted.includes(aotc.tos)) {
                  progressionSummary += ' \`AOTC\`';
                }
              } else
              if (progressionRaids[i].short === 'ABT') {
                if(achievementsCompleted.includes(ce.abt)) {
                  progressionSummary += ' \`CE\`';
                } else
                if (achievementsCompleted.includes(aotc.abt)) {
                  progressionSummary += ' \`AOTC\`';
                }
              }

            }
          }
        }

        var charArmoryUrl = exports.getArmoryUrl(character, realm, region);
        var charRaiderIoUrl = raiderIo.getCharacterUrl(character, realm, region);
        var charLogsUrl = warcraftLogs.getCharacterUrl(character, realm, region);
        var charLinks = `[WarcraftLogs](${charLogsUrl}) | [Raider.IO](${charRaiderIoUrl})`;

        var charPvPUrl = charArmoryUrl + '/pvp';
        request(charPvPUrl, (err, res, body) => {
          if (err) {
            var owner = client.users.get(config.ownerID);
            message.channel.send(`Something's not quite right with PVP scraping... Complain to ${owner}`);

            logging.toonLogger.log({
              level: 'Error',
              message: `(battleNet.js:sendCharacterResponse) Request to Armory PVP site failed for ${character} ${realm} ${region}: ${err}`
            });
            return console.log(err);
          }

          var honorLevel = 0;
          var prestigeLevel = 0;
          // Scrape Armory PVP page for honor and prestige levels
          var $ = cheerio.load(body);
          $('.font-semp-xSmall-white').each(function(i, elem) {
            if (i === 0) {
              prestigeLevel = $(this).text().replace('Level ', '');
            } else
            if (i === 1) {
              honorLevel = $(this).text().replace('Level ', '');
            }
          });

          var embedFields = [
            {
              name: 'Stats',
              value: `**${mainBookmarkStat}:** ${mainBookmarkStatValue.toLocaleString()} \n**Crit:** ${stats.crit.toFixed(2)}%\n**Haste:** ` +
              `${stats.haste.toFixed(2)}%\n**Mastery:** ${stats.mastery.toFixed(2)}%\n**Versatility:** ${versBonus.toFixed(2)}%\n`,
              inline: true
            },
            {
              name: 'PVP',
              value: `**Prestige Level:** ${prestigeLevel}\n**Honor Level:** ${honorLevel}\n**2v2 Rating:** ${pvpBrackets.ARENA_BRACKET_2v2.rating.toLocaleString()}\n` +
              `**3v3 Rating:** ${pvpBrackets.ARENA_BRACKET_3v3.rating.toLocaleString()}\n**Battleground Rating:** ` +
              `${pvpBrackets.ARENA_BRACKET_RBG.rating.toLocaleString()}\n**Honorable Kills:** ` +
              `${response.data.totalHonorableKills.toLocaleString()}\n`,
              inline: true
            },
            {
              name: 'Links',
              value: charLinks
            }
          ];
          if (charLevel === 110) {
            embedFields.splice(1, 0, {name: 'Raid Progression', value: progressionSummary, inline: true});
            embedFields.splice(3, 0, {name: 'Mythic+', value: mythicPlusSummary, inline: true});
          }

          message.channel.send({embed: {
             color: embedColor,
             title: `Level ${charLevel} ${charRace.name} ${currentSpec.spec.name} ${charClass.name}\n`,
             url: charArmoryUrl,
             description: `**Average ILVL:** ${items.averageItemLevelEquipped.toLocaleString()}\n**Artifact Traits:** ${artifactTraits}\n` +
             `**Achievement Points:** ${response.data.achievementPoints.toLocaleString()}\n`,
             author: {
               name: `${characterNameTitle} @ ${response.data.realm}`,
               icon_url: specIconUrl
             },
             thumbnail: {
               url: characterImageUrlThumbnail
             },
             fields: embedFields,
             footer: {
               icon_url: common.bilgewaterIconUrl,
               text: 'Character Data | Powered by Bilgewater Bot'
             }
           }});

        });
      }).catch(error => {
         message.channel.send('\`\`\`Character not found. Check spelling and region.\`\`\`');

         logging.toonLogger.log({
           level: 'Error',
           message: `(battleNet.js:sendCharacterResponse) Character request to Battle.net failed for ${character} ${realm} ${region}\n${error.stack}`
         });
      });

    });

  });
}

exports.sendCollectionsResponse = function (character, realm, region, message) {
  blizzard.wow.character(['titles', 'mounts', 'pets'], { origin: region, realm: realm, name: character })
  .then(response => {
    var characterNameTitle = exports.getNameAndTitle(response.data);

    var collectedMounts = response.data.mounts.collected;
    var collectedPets = response.data.pets.collected;

    var randomCollected = '';
    var collectedSelector = common.getRandomIntInclusive(0, 1);
    if (collectedSelector === 0) {
        randomCollected = collectedMounts[common.getRandomIntInclusive(0, collectedMounts.length - 1)];
    }
    else {
      randomCollected = collectedPets[common.getRandomIntInclusive(0, collectedPets.length - 1)];
    }

    var collectionAuthorIconUrl = util.format(exports.iconRenderUrl, region, iconSize, 'spell_nature_swiftness');
    var collectionIconUrl = util.format(exports.iconRenderUrl, region, iconSize, randomCollected.icon);

    var charArmoryUrl = exports.getArmoryUrl(character, realm, region);
    var charCollectionUrl = charArmoryUrl + '/collections/mounts';

    var embedColor = exports.getFactionEmbedColor(response.data.faction);
    var embedTitle = `${characterNameTitle} @ ${response.data.realm}`;
    var embedUrl = charCollectionUrl;
    var embedAuthor = {
      name: 'Collections',
      icon_url: collectionAuthorIconUrl
    };
    var embedFields = [
      {
        name: 'Mounts',
        value: `${response.data.mounts.numCollected}/${response.data.mounts.numCollected + response.data.mounts.numNotCollected}`,
        inline: true
      },
      {
        name: 'Pets',
        value: `${response.data.pets.numCollected}/${response.data.pets.numCollected + response.data.pets.numNotCollected}`,
        inline: true
      }
    ];
    var embedThumbnail = {
      url: collectionIconUrl
    };
    var embedFooter = {
      icon_url: common.bilgewaterIconUrl,
      text: 'Collections Data | Powered by Bilgewater Bot'
    };

    var messageEmbed = common.buildEmbed(embedColor, embedTitle, embedUrl, embedAuthor, embedThumbnail, embedFields, embedFooter)

    message.channel.send({embed: messageEmbed});

  }).catch(error => {
     message.channel.send('\`\`\`Character not found. Check spelling and region.\`\`\`');

     logging.toonLogger.log({
       level: 'Error',
       message: `(battleNet.js:buildCollectionsResponse) Character request to Battle.net failed for ${character} ${realm} ${region}\n${error.stack}`
     });
  });
}

exports.sendProfessionsResponse = function (character, realm, region, message) {
  blizzard.wow.character(['titles', 'professions'], { origin: region, realm: realm, name: character })
  .then(response => {
    var professions = response.data.professions;

    var professionsAuthorIconUrl = util.format(exports.iconRenderUrl, region, iconSize, 'inv_pick_02');
    var primaryProfessionsSummary = '';
    var secondaryProfessionsSummary = '';
    professionsIconUrl =  util.format(exports.iconRenderUrl, region, iconSize, professions.primary[0].icon);

    var primaryNum = 0;
    for (var i = 0; i < professions.primary.length; i++) {
     var profession = professions.primary[i];
     if(profession.max === 0) {
       continue;
     }
     primaryNum++;
     primaryProfessionsSummary += `**${profession.name}**\nRank: ${profession.rank}/${profession.max}`;
     if (profession.recipes.length > 0) {
       primaryProfessionsSummary += `\nRecipes Learned: ${profession.recipes.length}`;
     }
     primaryProfessionsSummary += '\n\n';
    }
    if (primaryNum === 0){
      primaryProfessionsSummary = 'None';
    }

    var secondaryNum = 0;
    for (var i = 0; i < professions.secondary.length; i++) {
      var profession = professions.secondary[i];
      if(profession.max === 0) {
       continue;
      }
      secondaryNum++;
      secondaryProfessionsSummary += `**${profession.name}**\nRank: ${profession.rank}/${profession.max}`;
      if (profession.recipes.length > 0) {
       secondaryProfessionsSummary += `\nRecipes Learned: ${profession.recipes.length}`;
      }
      secondaryProfessionsSummary += '\n\n';
    }
    if (secondaryNum === 0){
      secondaryProfessionsSummary = 'None';
    }

    var characterNameTitle = exports.getNameAndTitle(response.data);
    var charArmoryUrl = exports.getArmoryUrl(character, realm, region);

    var embedColor = exports.getFactionEmbedColor(response.data.faction);
    var embedTitle = `${characterNameTitle} @ ${response.data.realm}`;
    var embedUrl = charArmoryUrl;
    var embedAuthor = {
      name: 'Professions',
      icon_url: professionsAuthorIconUrl
    };
    var embedThumbnail = {
      url: professionsIconUrl
    };
    var embedFields =  [
      {
        name: 'Primary',
        value: primaryProfessionsSummary,
        inline: true
      },
      {
        name: 'Secondary',
        value: secondaryProfessionsSummary,
        inline: true
      }
    ];
    var embedFooter = {
      icon_url: common.bilgewaterIconUrl,
      text: 'Professions Data | Powered by Bilgewater Bot'
    };

    var messageEmbed = common.buildEmbed(embedColor, embedTitle, embedUrl, embedAuthor, embedThumbnail, embedFields, embedFooter)

    message.channel.send({embed: messageEmbed});

  }).catch(error => {
     message.channel.send('\`\`\`Character not found. Check spelling and region.\`\`\`');

     logging.toonLogger.log({
       level: 'Error',
       message: `(battleNet.js:buildProfessionsResponse) Character request to Battle.net failed for ${character} ${realm} ${region}\n${error.stack}`
     });
  });
}

exports.sendAchievementsResponse = function (character, realm, region, message) {
  blizzard.wow.character(['titles', 'achievements'], { origin: region, realm: realm, name: character })
  .then(response => {
    var achievements = response.data.achievements;
    var achievementsCompleted = achievements.achievementsCompleted;

    var achievementsAuthorIconUrl = util.format(exports.iconRenderUrl, region, iconSize, 'inv_pick_02');

    var characterNameTitle = exports.getNameAndTitle(response.data);
    var charArmoryUrl = exports.getArmoryUrl(character, realm, region);

    var embedColor = exports.getFactionEmbedColor(response.data.faction);
    var embedTitle = `${characterNameTitle} @ ${response.data.realm}`;
    var embedUrl = charArmoryUrl;
    var embedAuthor = {
      name: 'Achievements',
      icon_url: achievementsAuthorIconUrl
    };
    var embedThumbnail = {
      url: achievementsIconUrl
    };
    var embedFields =  [
      {
        name: 'Stuff',
        value: 'Things',
        inline: true
      }
    ];
    var embedFooter = {
      icon_url: common.bilgewaterIconUrl,
      text: 'Achievements Data | Powered by Bilgewater Bot'
    };

    var messageEmbed = common.buildEmbed(embedColor, embedTitle, embedUrl, embedAuthor, embedThumbnail, embedFields, embedFooter)

    message.channel.send({embed: messageEmbed});

  }).catch(error => {
     message.channel.send('\`\`\`Character not found. Check spelling and region.\`\`\`');

     logging.toonLogger.log({
       level: 'Error',
       message: `(battleNet.js:buildAchievementsResponse) Character request to Battle.net failed for ${character} ${realm} ${region}\n${error.stack}`
     });
  });
}