module.exports.commands = {
  change: {
    usage: 'Usage: change #channel-name',
    desc: 'Changes the channel where the tweets are sent',
    async execute (client, msg, param, db) {
      if (!param[1] || (msg.mentions.channels.size === 0 && !msg.guild.channels.some(c => c.name === param[1].toLowerCase()))) return msg.channel.send('Invalid channel name')
      let name

      if (msg.mentions.channels.size > 0) name = msg.mentions.channels.first().name
      else name = param[1].toLowerCase()

      db.prepare('UPDATE tweetChannels SET name = ? WHERE guild = ?').run(name, msg.guild.id)
      msg.channel.send('Settings updated')
    }
  }
}
