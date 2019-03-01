const { log } = require('../../utilities.js')
const puppeteer = require('puppeteer')
const path = require('path')
const config = require('../../data/config.json')
const twit = require('twit')(config.twitter)
const PQueue = require('p-queue')
const { MessageEmbed } = require('discord.js')

const queue = new PQueue({ concurrency: 1 })

let browser
let reactions = ['✅', '❎']

module.exports = {
  reqs (client, db) {
    return new Promise((resolve, reject) => {
      db.prepare('CREATE TABLE IF NOT EXISTS tweets (id TEXT, user TEXT, PRIMARY KEY (id, user))').run()
      db.prepare('CREATE TABLE IF NOT EXISTS processed (user TEXT, tweet TEXT, PRIMARY KEY (user))').run()
      db.prepare('CREATE TABLE IF NOT EXISTS approval (id TEXT, url TEXT, PRIMARY KEY (id))').run()
      db.prepare('CREATE TABLE IF NOT EXISTS tweetChannels (guild TEXT, name TEXT, PRIMARY KEY (guild))').run()
      resolve()
    })
  },
  events: {
    async guildCreate (client, db, moduleName, guild) {
      db.prepare('INSERT OR IGNORE INTO tweetChannels (guild,name) VALUES (?, \'destiny-news\')').run(guild.id)
      if (!guild.channels.some(c => c.name === 'destiny-news')) {
        guild.channels.create('destiny-news')
      }
    },

    async ready (client, db, moduleName) {
      client.guilds.forEach(guild => {
        db.prepare('INSERT OR IGNORE INTO tweetChannels (guild,name) VALUES (?, \'destiny-news\')').run(guild.id)
      })
      run()

      async function changeTimeout () {
        try {
          let data = await twit.get('application/rate_limit_status', { resources: 'statuses' })
          let { limit } = data.data.resources.statuses['/statuses/user_timeline']

          let accCount = config.accounts.length + config.approval.length
          console.log(`Next cycle on ${900000 / limit * accCount}`)
          setTimeout(run, 900000 / limit * accCount)
        } catch (err) { console.log(err) }
      }

      function run () {
        console.log(client.guilds.map(g => g.name))
        console.log('Running twitter cycle')

        config.accounts.concat(config.approval).forEach(account => {
          let proc = db.prepare('SELECT tweet FROM processed WHERE user = ?').get(account)

          if (proc) {
            twit.get('statuses/user_timeline', { screen_name: account, since_id: proc.tweet }).then(res => {
              let { data } = res
              if (data[0]) {
                db.prepare('INSERT OR IGNORE INTO processed(user,tweet) VALUES(?,?)').run(data[0].user.screen_name, data[0].id_str)
                db.prepare('UPDATE processed SET tweet = ? WHERE user = ?').run(data[0].id_str, data[0].user.screen_name)
              }
              console.log(`${account}: ${data.length} tweets`)
              data.forEach(tweet => {
                let checkId = tweet.retweeted_status ? tweet.retweeted_status.id_str : tweet.id_str
                let check = db.prepare('SELECT id FROM tweets WHERE id=? AND user=?').get(checkId, tweet.user.screen_name)
                if (!check) {
                  db.prepare('INSERT INTO tweets (id,user) VALUES (?,?)').run(tweet.id_str, tweet.user.screen_name)
                  let type = config.approval.includes(account) ? 'approval' : config.accounts.includes(account) ? 'accounts' : undefined
                  console.log(type)

                  queue.add(() => screenshotTweet(client, tweet.id_str, config.approval.includes(account))).then(shotBuffer => {
                    let url = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}/`
                    switch (type) {
                      case 'approval':
                        let out = {}

                        let embed = new MessageEmbed()
                          .setAuthor(`${tweet.user.name} | ${tweet.user.screen_name}`, tweet.user.profile_image_url)
                          .setThumbnail()
                          .setColor(tweet.user.profile_background_color)
                          .setTimestamp()

                        embed.addField('URL', url)
                        embed.attachFiles([{ name: 'imageTweet.png', attachment: shotBuffer }])
                          .setImage('attachment://imageTweet.png')
                          .setTimestamp()

                        out.embed = embed

                        client.guilds.get(config.ownerGuild).channels.find(c => c.name === 'tweet-approval').send(out).then(m => {
                          m.react('✅').then(() => {
                            m.react('❎').then(() => {
                              db.prepare('INSERT INTO approval (id,url) VALUES (?,?)').run(m.id, url)
                            })
                          })
                        })
                        break

                      case 'accounts':
                        let msg = { content: `<${url}>`, files: [shotBuffer] }

                        postTweet(client, db, msg, tweet.id_str, tweet.user.screen_name !== 'UpdatesVanguard')
                        break
                    }
                  })
                }
              })
            })
          } else {
            twit.get('statuses/user_timeline', { screen_name: account, count: 1 }).then(res => {
              let { data } = res
              if (data[0]) {
                db.prepare('INSERT OR IGNORE INTO processed(user,tweet) VALUES(?,?)').run(data[0].user.screen_name, data[0].id_str)
              }
              console.log(`Synced ${account}`)
            })
          }
        })

        changeTimeout()
      }
    },

    async messageReactionAdd (client, db, moduleName, reaction, user) {
      if (reaction.message.guild.id !== config.ownerGuild) return
      if (reaction.message.partial) await reaction.message.fetch()
      if (
        reaction.message.channel.name === 'tweet-approval' &&
        !user.bot &&
        reactions.includes(reaction.emoji.name)
      ) {
        switch (reaction.emoji.name) {
          case '✅':
            let tweet = db.prepare('SELECT url FROM approval WHERE id=?').get(reaction.message.id)
            if (!tweet) return

            let tweetId = tweet.url.split('/').slice(-2)[0]
            postTweet(client, db, { content: `<${tweet.url}>`, files: [`temp/${tweetId}.png`] }, tweetId)

            reaction.message.delete()
            break

          case '❎':
            let tweetFound = db.prepare('SELECT url FROM approval WHERE id=?').get(reaction.message.id)
            if (!tweetFound) return

            db.prepare('DELETE FROM approval WHERE id=?').run(reaction.message.id)
            reaction.message.delete()
            break
        }
      }
    }
  }
}

function screenshotTweet (client, id, usePath = false) {
  return new Promise(async (resolve, reject) => {
    if (!browser) browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    page.setViewport({ width: 1000, height: 600, deviceScaleFactor: 5 })

    page.goto(path.join('file://', __dirname, `index.html?id=${id}`)).catch(err => {
      log(client, path.join('file://', __dirname, `index.html?id=${id}`))
      log(client, err.stack)
    })
    setTimeout(async () => {
      const rect = await page.evaluate(() => {
        const element = document.querySelector('#container')
        const { x, y, width, height } = element.getBoundingClientRect()
        return { left: x, top: y, width, height, id: element.id }
      })
      let screenOptions = {
        clip: {
          x: rect.left,
          quality: 85,
          y: rect.top,
          width: 550,
          height: rect.height
        }
      }
      if (usePath) screenOptions.path = `temp/${id}.png`

      let buffer = await page.screenshot(screenOptions)
      await page.close()
      resolve(buffer)
    }, 30 * 1000)
  })
}

function postTweet (client, db, content, tweetId, retweet = true) {
  client.guilds.forEach(guild => {
    try {
      let { name } = db.prepare('SELECT name FROM tweetChannels WHERE guild=?').get(guild.id)
      guild.channels.find(c => c.name === name).send(content)
    } catch (err) {
      console.log(err)
    }
  })

  if (retweet) twit.post('statuses/retweet/:id', { id: tweetId }).catch(err => console.log(err))
}
