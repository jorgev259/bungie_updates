const { broadcast } = require('./util.js')
const { MessageEmbed } = require('discord.js')

module.exports.commands = {
  change: {
    usage: 'change #channel-name',
    desc: 'Changes the channel where the tweets are sent',
    async execute (client, msg, param, db) {
      if (!param[1] || (msg.mentions.channels.size === 0 && !msg.guild.channels.some(c => c.name === param[1].toLowerCase()))) return msg.channel.send('Invalid channel name')
      let name

      if (msg.mentions.channels.size > 0) name = msg.mentions.channels.first().name
      else name = param[1].toLowerCase()

      db.prepare('UPDATE config SET value = ? WHERE guild = ? AND type=?').run(name, msg.guild.id, 'twitter_channel')
      // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, 'twitter_channel').value
      msg.channel.send('Settings updated')
    }
  },
  broadcast: {
    desc: 'Sends a message to all servers',
    config: {
      ownerOnly: true
    },
    async execute (client, msg, param, db) {
      broadcast(client, db, param.slice(1).join(' '))
    }
  },
  sync: {
    desc: 'Forced channel sync',
    config: {
      ownerOnly: true
    },
    async execute (client, msg, param, db) {
      client.guilds.forEach(guild => {
        var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, 'twitter_channel').value

        if (!guild.channels.some(c => c.name === channel)) {
          guild.channels.create(channel)
        }
      })
    }
  },
  accounts: {
    desc: 'Shows a list of the accounts being tracked',
    async execute (client, msg, param, db) {
      const { accounts } = client.data['lotus_config.twitter']
      const perms = {}
      accounts.forEach(element => {
        let type
        if (element.type === 'approval') type = 'Approval'
        else type = 'Automatic'
        if (!perms[type]) perms[type] = []
        perms[type].push(element.account)
      })

      const types = Object.keys(perms)

      const embed = new MessageEmbed()
        .setTitle('Twitter Accounts')

      for (let i = 0; i < types.length; i++) {
        embed.addField(types[i], perms[types[i]].join('\n'))
        if (i !== types.length - 1) embed.addBlankField()
      }

      msg.channel.send(embed)
    }
  },
  test: {
    desc: 'Sends a test announcement.',
    async execute (client, msg, param, db) {
      // let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(msg.guild.id)
      var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(msg.guild.id, 'twitter_channel').value
      console.log(channel)
      msg.guild.channels.find(c => c.name === channel).send('Dont mind me, just checking everything is working. (Test Announcement)', { files: ['modules/twitter/test.gif'] }).catch(err => msg.channel.send(err.message))
    }
  }

}
