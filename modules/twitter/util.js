module.exports = {
  broadcast: function (client, db, content) {
    client.guilds.forEach(guild => {
      try {
        // let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(guild.id)
        var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, 'twitter_channel').value
        guild.channels.find(c => c.name === channel).send(content)
      } catch (err) {
        console.log(err)
      }
    })
  }
}