const { log } = global.requireFn('./utilities.js')
const { broadcast } = require('./util.js')
const puppeteer = global.requireFn('puppeteer')
const path = require('path')
const { default: PQueue } = global.requireFn('p-queue')
const { MessageEmbed } = global.requireFn('discord.js')
const fs = global.requireFn('fs-extra')

const queue = new PQueue({ concurrency: 1 })

let browser
const reactions = ['✅', '❎']

module.exports = {
  async guildCreate (client, db, moduleName, guild) {
    const { defaultChannel } = client.config.twitter_global.config
    // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, config.default_channel).value

    if (!guild.channels.some(c => c.name === defaultChannel)) {
      guild.channels.create(defaultChannel)
    }
    updateTopic(client)
  },

  async ready (client, db, moduleName) {
    fs.ensureDirSync('temp')
    const { rateTwitter, accounts, twitter } = client.config.twitter_global.config

    const twit = global.requireFn('twit')(twitter)
    console.log('Running twitter cycles')
    run()

    async function changeTimeout () {
      try {
        // let timeout = 900000 / limit * accCount >= 5000 ? 900000 / limit * accCount : 5000
        setTimeout(run, rateTwitter)
      } catch (err) { console.log(err) }
    }

    function run () {
      accounts.forEach(item => {
        const { account, type } = item
        const proc = db.prepare('SELECT tweet FROM global_processed WHERE user = ?').get(account)

        if (proc) {
          twit.get('statuses/user_timeline', { screen_name: account, since_id: proc.tweet, tweet_mode: 'extended' }).then(res => {
            const { data } = res
            if (data[0]) {
              db.prepare('INSERT OR IGNORE INTO global_processed(user,tweet) VALUES(?,?)').run(data[0].user.screen_name, data[0].id_str)
              db.prepare('UPDATE global_processed SET tweet = ? WHERE user = ?').run(data[0].id_str, data[0].user.screen_name)
            }

            if (data.length > 0) console.log(`${account}: ${data.length} tweets`)
            data.forEach(tweet => {
              const check = db.prepare('SELECT id FROM global_tweets WHERE id=? AND user=?').get(
                tweet.retweeted_status ? tweet.retweeted_status.id_str : tweet.id_str,
                tweet.retweeted_status ? tweet.retweeted_status.user.screen_name : tweet.user.screen_name
              )

              if (!check || (tweet.is_quote_status && type !== 'base_accounts')) {
                if (tweet.retweeted) tweet = tweet.retweeted_status
                db.prepare('INSERT INTO global_tweets (id,user) VALUES (?,?)').run(tweet.id_str, tweet.user.screen_name)

                if (item.filter) {
                  item.filter(tweet).then(result => {
                    if (result) evalTweet(client, db, tweet, item)
                  })
                } else {
                  evalTweet(client, db, tweet, item)
                }
              }
            })
          }).catch(err => { console.log(err); console.log({ screen_name: account, since_id: proc.tweet, tweet_mode: 'extended' }) })
        } else {
          twit.get('statuses/user_timeline', { screen_name: account, count: 1 }).then(res => {
            const { data } = res
            if (data[0]) {
              db.prepare('INSERT OR IGNORE INTO global_processed(user,tweet) VALUES(?,?)').run(data[0].user.screen_name, data[0].id_str)
            }
            console.log(`Synced ${account}`)
          })
        }
      })

      changeTimeout()
    }

    updateTopic(client)
  },

  async messageReactionAdd (client, db, moduleName, reaction, user) {
    const { ownerGuild } = global.requireFn('./lotus/config.json')
    if (reaction.message.guild.id !== ownerGuild) return
    if (reaction.message.partial) await reaction.message.fetch()
    if (
      reaction.message.channel.name === 'tweet-approval' &&
        !user.bot &&
        reactions.includes(reaction.emoji.name)
    ) {
      switch (reaction.emoji.name) {
        case '✅': {
          const tweet = db.prepare('SELECT url FROM global_approval WHERE id=?').get(reaction.message.id)
          if (!tweet) return

          const tweetId = tweet.url.split('/').slice(-2)[0]
          postTweet(client, db, { content: `<${tweet.url}>`, files: [`temp/${tweetId}.png`] }, tweetId)

          reaction.message.delete()
          break
        }

        case '❎': {
          const tweetFound = db.prepare('SELECT url FROM global_approval WHERE id=?').get(reaction.message.id)
          if (!tweetFound) return

          db.prepare('DELETE FROM global_approval WHERE id=?').run(reaction.message.id)
          reaction.message.delete()
          break
        }
      }
    }
  }
}

function evalTweet (client, db, tweet, item) {
  const { ownerGuild } = global.requireFn('./lotus/config.json')
  const { type } = item
  const url = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}/`
  if (type !== 'media') {
    queue.add(() => screenshotTweet(client, tweet.id_str, type === 'approval' || type === 'base_accounts')).then(shotBuffer => {
      updateTopic(client)

      switch (type) {
        case 'approval': {
          const out = {}

          const embed = new MessageEmbed()
            .setAuthor(`${tweet.user.name} | ${tweet.user.screen_name}`, tweet.user.profile_image_url)
            .setThumbnail()
            .setColor(tweet.user.profile_background_color)
            .setTimestamp()

          embed.addField('URL', url)
          embed.attachFiles([{ name: 'imageTweet.png', attachment: shotBuffer }])
            .setImage('attachment://imageTweet.png')
            .setTimestamp()

          out.embed = embed

          client.guilds.cache.get(ownerGuild).channels.cache.find(c => c.name === 'tweet-approval').send(out).then(m => {
            m.react('✅').then(() => {
              m.react('❎').then(() => {
                db.prepare('INSERT INTO global_approval (id,url) VALUES (?,?)').run(m.id, url)
              })
            })
          })
          break
        }

        case 'accounts':
        case 'base_accounts':
        {
          const msg = { content: `<${url}>`, files: [shotBuffer] }

          postTweet(client, db, msg, tweet.id_str, type !== 'base_accounts')
          break
        }
      }
    })
  } else {
    const photos = tweet.entities.media.filter(media => media.type === 'photo')
    if (photos.length > 0) {
      postTweet(client, db,
        { content: `<${url}>${item.extraText ? item.extraText : ''}`, files: photos.map(e => e.media_url_https) },
        tweet.id_str,
        true
      )
    }
  }
}

function screenshotTweet (client, id, usePath) {
  return new Promise((resolve, reject) => {
    updateTopic(client)
    if (!browser) {
      puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }).then(newBrowser => {
        browser = newBrowser
        evalPage()
      })
    } else evalPage()

    async function evalPage () {
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
        const screenOptions = {
          clip: {
            x: rect.left,
            quality: 85,
            y: rect.top,
            width: 550,
            height: rect.height
          }
        }
        if (usePath) screenOptions.path = `temp/${id}.png`

        const buffer = await page.screenshot(screenOptions)
        await page.close()
        resolve(buffer)
      }, 30 * 1000)
    }
  })
}

function postTweet (client, db, content, tweetId = null, retweet = false) {
  const { twitter } = client.config.twitter_global.config
  const twit = global.requireFn('twit')(twitter)
  broadcast(client, db, content)
  if (twitter.access_token && retweet) twit.post('statuses/retweet/:id', { id: tweetId }).catch(err => console.log(err))
}

function updateTopic (client) {
  const { ownerGuild } = global.requireFn('./lotus/config.json')
  const found = client.guilds.cache.get(ownerGuild).channels.cache.find(c => c.name === 'tweet-approval')
  if (found) found.setTopic(`Guilds: ${client.guilds.cache.size} / Processing: ${queue.size}`)
}
