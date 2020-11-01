// const { log } = require('../../utilities.js')
const path = require('path')
const puppeteer = global.requireFn('puppeteer')
const { default: PQueue } = global.requireFn('p-queue')
const { MessageEmbed } = global.requireFn('discord.js')

const queue = new PQueue({ concurrency: 1 })

let browser
const reactions = ['✅', '❎']

module.exports = {
  async guildCreate (client, sequelize, moduleName, guild) {
    const { defaultChannel } = client.config.twitter_global.config
    // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, config.default_channel).value

    if (!guild.channels.some(c => c.name === defaultChannel)) {
      guild.channels.create(defaultChannel)
    }
  },

  async ready (client, sequelize, moduleName) {
    const { rateTwitter, twitter } = client.config.twitter_guild.config
    const { guildAccounts, guildProcessed, guildTweets } = sequelize.models
    const twit = global.requireFn('twit')(twitter)
    run()

    async function changeTimeout () {
      try {
        setTimeout(run, rateTwitter)
      } catch (err) { console.log(err) }
    }

    async function run () {
      const accounts = await guildAccounts.findAll()
      accounts.forEach(async item => {
        const { guild, user } = item
        const proc = await guildProcessed.findOne({ where: { user, guild } })

        if (proc) {
          twit.get('statuses/user_timeline', { screen_name: user, since_id: proc.tweet, tweet_mode: 'extended' }).then(async res => {
            const { data } = res
            if (data[0]) {
              const [itemCreated, created] = await guildProcessed.findOrCreate({ where: { guild, user: data[0].user.screen_name }, defaults: { tweet: data[0].id_str } })
              if (!created) {
                itemCreated.tweet = data[0].id_str
                await itemCreated.save()
              }
            }

            if (data.length > 0) console.log(`${user}: ${data.length} tweets`)
            data.forEach(async tweet => {
              const check = await guildTweets.findOne({
                where: {
                  id: tweet.retweeted_status ? tweet.retweeted_status.id_str : tweet.id_str,
                  user: tweet.retweeted_status ? tweet.retweeted_status.user.screen_name : tweet.user.screen_name,
                  guild
                }
              })

              if (!check || tweet.is_quote_status) {
                if (tweet.retweeted) tweet = tweet.retweeted_status
                await guildTweets.create({ id: tweet.id_str, user: tweet.user.screen_name, guild })

                evalTweet(client, sequelize, tweet, item)
              }
            })
          }).catch(err => { console.log(err); console.log({ screen_name: user, since_id: proc.tweet, tweet_mode: 'extended' }) })
        } else {
          twit.get('statuses/user_timeline', { screen_name: user, count: 1 }).then(async res => {
            const { data } = res
            if (data[0]) {
              await guildProcessed.findOrCreate({ where: { user: data[0].user.screen_name, guild }, defaults: { tweet: data[0].id_str } })
            }
            console.log(`Synced ${user}`)
          })
        }
      })

      changeTimeout()
    }
  },

  async messageReactionAdd (client, sequelize, moduleName, reaction, user) {
    const { guildApproval } = sequelize.models
    if (reaction.message.partial) await reaction.message.fetch()
    if (
      reaction.message.channel.name === 'tweet-approval' &&
        !user.bot &&
        reactions.includes(reaction.emoji.name)
    ) {
      switch (reaction.emoji.name) {
        case '✅': {
          const tweet = await guildApproval.findOne({ where: { id: reaction.message.id, guild: reaction.message.guild.id } })
          if (!tweet) return

          const tweetId = tweet.url.split('/').slice(-2)[0]
          postTweet(client, sequelize, { content: `<${tweet.url}>`, files: [`temp/${tweetId}.png`] }, tweetId)

          reaction.message.delete()
          break
        }

        case '❎': {
          const tweetFound = await guildApproval.findOne({ where: { id: reaction.message.id, guild: reaction.message.guild.id } })
          if (!tweetFound) return

          await tweetFound.destroy()
          reaction.message.delete()
          break
        }
      }
    }
  }
}

function evalTweet (client, sequelize, tweet, item) {
  const { guildApproval } = sequelize.models
  const { guild, type, channel } = item
  const url = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}/`
  if (type !== 'media') {
    queue.add(() => screenshotTweet(client, tweet.id_str, type === 'approval')).then(shotBuffer => {
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

          client.guilds.cache.get(guild).channels.cache.find(c => c.name === 'tweet-approval').send(out).then(m =>
            m.react('✅').then(() =>
              m.react('❎').then(() => guildApproval.create({ guild, url, id: m.id }))
            )
          )
          break
        }

        case 'auto':
        {
          const msg = { content: `<${url}>`, files: [shotBuffer] }

          postTweet(client, sequelize, msg, guild, channel)
          break
        }
      }
    })
  } else {
    const photos = tweet.entities.media.filter(media => media.type === 'photo')
    if (photos.length > 0) {
      postTweet(client, sequelize,
        { content: `<${url}>${item.extraText ? item.extraText : ''}`, files: photos.map(e => e.media_url_https) },
        guild, channel
      )
    }
  }
}

function screenshotTweet (client, id, usePath) {
  return new Promise((resolve, reject) => {
    if (!browser) {
      puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }).then(newBrowser => {
        browser = newBrowser
        evalPage()
      })
    } else evalPage()

    async function evalPage () {
      const page = await browser.newPage()
      page.setViewport({ width: 1000, height: 600, deviceScaleFactor: 5 })

      page.goto(path.join('file://', __dirname, `index.html?id=${id}`))
      /* .catch(err => {
        // log(client, path.join('file://', __dirname, `index.html?id=${id}`))
        // log(client, err.stack)
      }) */
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

function postTweet (client, sequelize, content, guild, channel) {
  client.guilds.cache.get(guild).channels.cache.get(channel).send(content)
}
