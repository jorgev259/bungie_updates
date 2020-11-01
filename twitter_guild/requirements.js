const { DataTypes } = global.requireFn('sequelize')
const { STRING } = DataTypes

module.exports = (client, sequelize) => {
  /* db.prepare('CREATE TABLE IF NOT EXISTS guild_tweets (guild TEXT, id TEXT, user TEXT, PRIMARY KEY (guild, id, user))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS guild_processed (guild TEXT, user TEXT, tweet TEXT, PRIMARY KEY (user, guild))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS guild_approval (guild TEXT, id TEXT, url TEXT, PRIMARY KEY (guild, id))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS guild_accounts (guild TEXT, user TEXT, type TEXT, channel TEXT, PRIMARY KEY (guild, user, channel))').run() */
  sequelize.define('guildTweet', {
    guild: { type: STRING, primaryKey: true },
    id: { type: STRING, primaryKey: true },
    user: { type: STRING, primaryKey: true }
  })
  sequelize.define('guildProcessed', {
    guild: { type: STRING, primaryKey: true },
    tweet: { type: STRING },
    user: { type: STRING, primaryKey: true }
  })
  sequelize.define('guildApproval', {
    guild: { type: STRING, primaryKey: true },
    id: { type: STRING, primaryKey: true },
    url: { type: STRING }
  })
  sequelize.define('guildAccounts', {
    guild: { type: STRING, primaryKey: true },
    user: { type: STRING, primaryKey: true },
    type: { type: STRING },
    channel: { type: STRING, primaryKey: true }
  })
}
