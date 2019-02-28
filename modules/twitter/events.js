const { log } = require('../../utilities.js')
const puppeteer = require('puppeteer')
const path = require('path')
const config = require('../../data/config.json')
const twit = require('twit')(config.twitter)
const PQueue = require('p-queue')
const { MessageEmbed } = require('discord.js')

const queue = new PQueue({ concurrency: 1 })

let browser
let accounts = ['Bungie', 'BungieHelp', 'DestinyTheGame', 'BungieStore']
let approval = ['A_dmg04', 'Cozmo23', 'DeeJ_BNG']
let reactions = ['✅', '❎']

module.exports = {
  reqs (client, db) {
    return new Promise((resolve, reject) => {
      db.prepare('CREATE TABLE IF NOT EXISTS tweets (id TEXT, user TEXT, PRIMARY KEY (id, user))').run()
      db.prepare('CREATE TABLE IF NOT EXISTS processed (user TEXT, tweet TEXT, PRIMARY KEY (user))').run()
      db.prepare('CREATE TABLE IF NOT EXISTS approval (id TEXT, url TEXT, PRIMARY KEY (id))').run()
      resolve()
    })
  },
  events: {
    async guildCreate (client, db, moduleName, guild) {
      console.log(guild)
      if (!guild.channels.some(c => c.name === 'destiny-news')) {
        guild.channels.create('destiny-news')
      }
    },

    async ready (client, db, moduleName) {
      run()

      async function changeTimeout () {
        try {
          let data = await twit.get('application/rate_limit_status', { resources: 'statuses' })
          let { limit } = data.data.resources.statuses['/statuses/user_timeline']

          let accCount = accounts.length + approval.length
          console.log(`Next cycle on ${900000 / limit * accCount}`)
          setTimeout(run, 900000 / limit * accCount)
        } catch (err) { console.log(err) }
      }

      function run () {
        console.log(client.guilds.size)
        console.log('Running twitter cycle')

        accounts.forEach(account => {
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
                let check = db.prepare('SELECT id FROM tweets WHERE id=? AND user=?').get(tweet.id_str, tweet.user.screen_name)
                if (!check) {
                  db.prepare('INSERT INTO tweets (id,user) VALUES (?,?)').run(tweet.id_str, tweet.user.screen_name)
                  queue.add(() => screenshotTweet(client, tweet.id_str)).then(shotBuffer => {
                    let url = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}/`
                    let msg = { content: `<${url}>`, files: [shotBuffer] }

                    client.guilds.forEach(guild => {
                      try {
                        guild.channels.find(c => c.name === 'destiny-news').send(msg)
                      } catch (err) {
                        console.log(err)
                      }
                    })
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

        approval.forEach(account => {
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
                let check = db.prepare('SELECT id FROM tweets WHERE id=? AND user=?').get(tweet.id_str, tweet.user.screen_name)
                if (!check) {
                  db.prepare('INSERT INTO tweets (id,user) VALUES (?,?)').run(tweet.id_str, tweet.user.screen_name)
                  queue.add(() => screenshotTweet(client, tweet.id_str)).then(shotBuffer => {
                    let out = {}

                    let embed = new MessageEmbed()
                      .setAuthor(`${tweet.user.name} | ${tweet.user.screen_name}`, tweet.user.profile_image_url)
                      .setThumbnail()
                      .setColor(tweet.user.profile_background_color)
                      .setTimestamp()

                    let url = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}/`

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

            client.guilds.forEach(guild => {
              try {
                guild.channels.find(c => c.name === 'destiny-news').send({ content: `<${tweet.url}>`, files: [`temp/${tweet.url.split('/').slice(-2)[0]}.png`] })
              } catch (err) {
                console.log(err)
              }
            })

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

function screenshotTweet (client, id) {
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
          path: `temp/${id}.png`,
          x: rect.left,
          quality: 85,
          y: rect.top,
          width: 550,
          height: rect.height
        }
      }

      let buffer = await page.screenshot(screenOptions)
      await page.close()
      resolve(buffer)
    }, 30 * 1000)
  })
}
