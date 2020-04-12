module.exports = (client, db) => {
  db.prepare('CREATE TABLE IF NOT EXISTS guild_tweets (guild TEXT, id TEXT, user TEXT, PRIMARY KEY (guild, id, user))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS guild_processed (guild TEXT, user TEXT, tweet TEXT, PRIMARY KEY (user, guild))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS guild_approval (guild TEXT, id TEXT, url TEXT, PRIMARY KEY (guild, id))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS guild_accounts (guild TEXT, user TEXT, type TEXT, channel TEXT, PRIMARY KEY (guild, user, channel))').run()
}
