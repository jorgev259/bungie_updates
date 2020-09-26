const { broadcast } = require('./util.js')
const { MessageEmbed } = global.requireFn('discord.js')

module.exports = {
  /* change: {
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
  }, */
  broadcast: {
    desc: 'Sends a message to all servers',
    config: {
      ownerOnly: true
    },
    async execute (client, msg, param, sequelize) {
      broadcast(client, sequelize, param.slice(1).join(' '))
    }
  },
  sync: {
    desc: 'Forced channel sync',
    config: {
      ownerOnly: true
    },
    async execute (client) {
      client.guilds.cache.forEach(guild => {
        // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, 'twitter_channel').value
        const { defaultChannel } = client.config.twitter_global.config

        if (!guild.channels.cache.some(c => c.name === defaultChannel)) {
          guild.channels.create(defaultChannel)
        }
      })
    }
  },
  accounts: {
    desc: 'Shows a list of the accounts being tracked',
    async execute (client, msg) {
      const { accounts } = client.config.twitter_global.config
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
      }

      msg.channel.send(embed)
    }
  },
  test: {
    desc: 'Sends a test announcement.',
    async execute (client, msg) {
      // let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(msg.guild.id)
      // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(msg.guild.id, 'twitter_channel').value
      // console.log(channel)

      const { defaultChannel } = client.config.twitter_global.config
      msg.guild.channels.cache.find(c => c.name === defaultChannel).send('Dont mind me, just checking everything is working. (Test Announcement)', { files: ['modules/twitter/test.gif'] }).catch(err => msg.channel.send(err.message))
    }
  }

}
