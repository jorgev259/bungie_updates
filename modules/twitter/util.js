module.exports = {
  broadcast: function (client, db, content) {
    client.guilds.forEach(guild => {
      try {
        let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(guild.id)
        guild.channels.find(c => c.name === name).send(content)
      } catch (err) {
        console.log(err)
      }
    })
  }
}
