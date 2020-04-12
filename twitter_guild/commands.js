const { MessageEmbed } = global.requireFn('discord.js')

module.exports = {
  addtwitter: {
    desc: 'Enables automatic posting for a Twitter account on the current server.',
    help: '>addtwitter [username] [auto/approval] [#channel]',
    async execute (client, msg, param, db) {
      if (!param[3]) return msg.channel.send('Missing parameters.\n>addtwitter [username] [auto/approval] [#channel]')
      if (!['auto', 'approval'].includes(param[2]) || msg.mentions.channels.size === 0) return msg.channel.send('Invalid parameters.\n>addtwitter [username] [auto/approval] [#channel]')

      db.prepare('INSERT INTO guild_accounts (guild,user,type,channel) VALUES (?,?,?,?)').run(msg.guild.id, param[1], param[2], msg.mentions.channels.first().id)
      msg.channel.send(`@${param[1]} added!`)
    }
  },
  removetwitter: {
    desc: 'Removes automatic posting for a Twitter account for a specific channel.',
    help: '>removetwitter [username] [#channel]',
    async execute (client, msg, param, db) {
      if (!param[2]) return msg.channel.send('Missing parameters.\n>removetwitter [username] [#channel]')
      if (msg.mentions.channels.size === 0) return msg.channel.send('Invalid parameters.\n>removetwitter [username] [#channel]')

      db.prepare('DELETE from guild_accounts WHERE guild=? AND user=? AND channel=?').run(msg.guild.id, param[1], msg.mentions.channels.first().id)
      msg.channel.send(`@${param[1]} on channel ${msg.mentions.channels.first()} removed!`)
    }
  },
  accounts: {
    desc: 'Shows a list of the accounts being tracked',
    async execute (client, msg, param, db) {
      const items = db.prepare('SELECT user,type FROM guild_accounts WHERE guild=?').all(msg.guild.id)

      const embed = new MessageEmbed()
        .setTitle('Twitter Accounts')
        .setDescription(items.map((e, i) => `${e.user} (${e.type})${i !== items.length - 1 ? '\n' : ''}`))

      msg.channel.send(embed)
    }
  }
}
