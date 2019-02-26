const { log } = require('../../utilities.js')
const puppeteer = require('puppeteer')
const path = require('path')
const config = require('../../data/config.json')
const twit = require('twit')(config.twitter)
const PQueue = require('p-queue')

const queue = new PQueue({ concurrency: 1 })

let browser
let accounts = ['Bungie', 'BungieHelp', 'DestinyTheGame', 'BungieStore']

module.exports = {
  reqs (client, db) {
    return new Promise((resolve, reject) => {
      db.prepare('CREATE TABLE IF NOT EXISTS tweets (id TEXT, user TEXT, PRIMARY KEY (id, user))').run()
      db.prepare('CREATE TABLE IF NOT EXISTS processed (user TEXT, tweet TEXT, PRIMARY KEY (user))').run()
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

          console.log(`Next cycle on ${900000 / limit * accounts.length}`)
          setTimeout(run, 900000 / limit * accounts.length)
        } catch (err) { console.log(err) }
      }

      function run () {
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
        changeTimeout()
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

      let buffer = await page.screenshot({
        clip: {
          x: rect.left,
          y: rect.top,
          width: 550,
          height: rect.height
        }
      })
      await page.close()
      resolve(buffer)
    }, 30 * 1000)
  })
}
