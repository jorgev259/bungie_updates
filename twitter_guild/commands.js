const { MessageEmbed } = global.requireFn('discord.js')

module.exports = {
  addtwitter: {
    desc: 'Enables automatic posting for a Twitter account on the current server.',
    help: '>addtwitter [username] [auto/approval] [#channel]',
    async execute (client, msg, param, sequelize) {
      if (!param[3]) return msg.channel.send('Missing parameters.\n>addtwitter [username] [auto/approval] [#channel]')
      if (!['auto', 'approval'].includes(param[2]) || msg.mentions.channels.size === 0) return msg.channel.send('Invalid parameters.\n>addtwitter [username] [auto/approval] [#channel]')

      await sequelize.models.guildAccounts.create({ guild: msg.guild.id, user: param[1], type: param[2], channel: msg.mentions.channels.first().id })

      msg.channel.send(`@${param[1]} added!`)
    }
  },
  removetwitter: {
    desc: 'Removes automatic posting for a Twitter account for a specific channel.',
    help: '>removetwitter [username] [#channel]',
    async execute (client, msg, param, sequelize) {
      if (!param[2]) return msg.channel.send('Missing parameters.\n>removetwitter [username] [#channel]')
      if (msg.mentions.channels.size === 0) return msg.channel.send('Invalid parameters.\n>removetwitter [username] [#channel]')

      await sequelize.models.guildAccounts.destroy({ where: { guild: msg.guild.id, user: param[1], channel: msg.mentions.channels.first().id } })
      msg.channel.send(`@${param[1]} on channel ${msg.mentions.channels.first()} removed!`)
    }
  },
  accounts: {
    desc: 'Shows a list of the accounts being tracked',
    async execute (client, msg, param, sequelize) {
      const items = await sequelize.models.guildAccounts.findAll({ where: { guild: msg.guild.id } })

      const embed = new MessageEmbed()
        .setTitle('Twitter Accounts')
        .setDescription(items.map((e, i) => `${e.user} (${e.type})${i !== items.length - 1 ? '\n' : ''}`))

      msg.channel.send(embed)
    }
  }
}
