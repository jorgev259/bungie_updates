const { broadcast } = require('./util.js')
module.exports.commands = {
  change: {
    usage: 'change #channel-name',
    desc: 'Changes the channel where the tweets are sent',
    async execute (client, msg, param, db) {
      if (!param[1] || (msg.mentions.channels.size === 0 && !msg.guild.channels.some(c => c.name === param[1].toLowerCase()))) return msg.channel.send('Invalid channel name')
      let name

      if (msg.mentions.channels.size > 0) name = msg.mentions.channels.first().name
      else name = param[1].toLowerCase()

      db.prepare('UPDATE tweetChannels SET name = ? WHERE guild = ?').run(name, msg.guild.id)
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
  test: {
    desc: 'Sends a test announcement.',
    async execute (client, msg, param, db) {
      let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(msg.guild.id)
      msg.guild.channels.find(c => c.name === name).send('Dont mind me, just checking everything is working. (Test Announcemet)', { files: ['modules/twitter/test.gif'] }).catch(err => msg.channel.send(err.message))
    }
  }

}
