![alt text](https://i.imgur.com/HRm3cYX.png "I got what you need!")
# Bilgewater-Bot 
Discord bot for displaying World of Warcraft statistics and information.

### Configuration

To configure the bot, create a file in the root project directory named "config.json"

```
{
   "token": "{Your Discord app token}",
   "prefix": "{Character or string to precede recognized commands}", Default - >
   "battlenet": "{Your Battle.net API token}",
   "ownerID": "{Your Discord user ID}",
   "game": "{Game the bot will be listed as playing on launch}" Default - >help
}
```

### Commands

>help - Displays available commands

>toon \<character\> \<realm\> -r \<region\> --- Looks up a character and displays some basic stats

>affix -schedule --- Displays mythic+ affix details and leaderboards for the current week
   
>logs \<character\> \<realm\> \<raid\> -r \<region\> -e \<encounter\> -d \<difficulty\> -m \<metric\> --- Get raid or encounter logs for a character

>setgame --- Sets the game that the bot is listed as playing, only the bot owner can use this command
