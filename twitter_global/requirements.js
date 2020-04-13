module.exports = (client, db) => {
  db.prepare('CREATE TABLE IF NOT EXISTS global_tweets (id TEXT, user TEXT, PRIMARY KEY (id, user))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS global_processed (user TEXT, tweet TEXT, PRIMARY KEY (user))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS global_approval (id TEXT, url TEXT, PRIMARY KEY (id))').run()
}
