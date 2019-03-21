const { log } = require('../../utilities.js')
const config = require('../../data/config.js')
var snoowrap = require('snoowrap')
const twit = require('twit')(config.twitter)

const r = new snoowrap(config.reddit)

module.exports = {
  reqs (client, db, moduleName) {
    return new Promise((resolve, reject) => {
      db.prepare('CREATE TABLE IF NOT EXISTS reddits (id TEXT, user TEXT, PRIMARY KEY (user))').run()
      resolve()
    })
  },
  config: {
    default: true
  },
  events: {
    async ready (client, db, moduleName) {
      run()

      function run () {
        console.log('Running reddit cycle')
        config.accountsReddit.forEach(async item => {
          let { account } = item
          let proc = db.prepare('SELECT id FROM reddits WHERE user = ?').get(account)

          if (proc) {
            let comments = (await r.getUser(account).getComments({ after: proc.id })).sort(function (a, b) { return a.created - b.created })
            db.prepare('UPDATE reddits SET id =? WHERE user =?').run(comments[comments.length - 1].id, comments[comments.length - 1].author.name)

            comments.forEach(comment => {
              if (item.filter) {
                item.filter(comment).then(result => {
                  if (result) post(comment)
                })
              } else {
                post(comment)
              }
            })

            let timeout = config.accountsReddit.length * 2000
            console.log(`Next cycle on ${timeout}`)
            setTimeout(run, timeout)
          } else {
            let res = await r.getUser(account).getComments({ limit: 1 })
            if (res[0]) {
              db.prepare('INSERT OR IGNORE INTO reddits(user,id) VALUES(?,?)').run(res[0].author.name, `t1_${res[0].id}`)
            }
            console.log(`Synced ${res[0].author.name}`)

            let timeout = config.accountsReddit.length * 2000
            console.log(`Next cycle on ${timeout}`)
            setTimeout(run, timeout)
          }
        })
      }
    },
  }
}

async function post (comment) {
  twit.post('statuses/update', { status: `${comment.link_title} (Reply by ${comment.author.name})\n${comment.body}\nSource: ${comment.link_permalin}` })
}