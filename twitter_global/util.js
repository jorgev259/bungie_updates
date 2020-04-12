module.exports = {
  broadcast: function (client, db, content) {
    const { defaultChannel } = client.data.lotus_config.twitter
    client.guilds.forEach(guild => {
      try {
        // let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(guild.id)
        // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, 'twitter_channel').value
        guild.channels.cache.find(c => c.name === defaultChannel).send(content)
      } catch (err) {
        console.log(err)
      }
    })
  }
}
