const { log } = require('../../utilities.js')
const config = require('../../data/config.js')
var snoowrap = require('snoowrap')
const twit = require('twit')(config.twitter)
var twitter = require('twitter-text')

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
            let comments = (await r.getUser(account).getComments({ before: proc.id })).sort(function (a, b) { return a.created - b.created })
            if (comments.length > 0) {
              console.log(`${account}: ${comments.length} tweets`)
              db.prepare('UPDATE reddits SET id =? WHERE user =?').run(`t1_${comments[comments.length - 1].id}`, comments[comments.length - 1].author.name)

              comments.forEach(comment => {
                if (item.filter) {
                  item.filter(comment).then(result => {
                    if (result) post(comment, item)
                  })
                } else {
                  post(comment)
                }
              })
            }
          } else {
            let res = await r.getUser(account).getComments({ limit: 1 })
            if (res[0]) {
              db.prepare('INSERT OR IGNORE INTO reddits(user,id) VALUES(?,?)').run(res[0].author.name, `t1_${res[0].id}`)
            }
            console.log(`Synced ${res[0].author.name}`)

            refresh(run)
          }
        })

        refresh(run)
      }
    }
  }
}

function refresh (run) {
  console.log(`Next cycle on ${config.rateReddit}`)
  setTimeout(run, config.rateReddit)
}

async function post (comment, item) {
  let title = `${comment.link_title}`
  let context = [`${comment.parent_id.startsWith('t1') ? `"${await r.getComment(comment.parent_id.split('_')[1]).body}"\n` : ''}`]
  let url = ` https://reddit.com${comment.permalink}`
  let body = `(Reply by ${item.handle}): ${comment.body}`

  let parse = twitter.txt.parseTweet(`${title}\n${context}${body}${url}`)
  if (parse.valid) twit.post('statuses/update', { status: `${title}\n${context}${body}${url}` })
  else {
    let parts = [`${title}\n${context}`, body, url]
    let finalParts = []
    /* while (!parts.every(function (e, i) {
      let text = i > 0 ? `@UpdatesVanguard ${e}` : e
      return twitter.txt.parseTweet(text).valid
    })) {
      let newParts = []
      for (var i = 0; i < parts.length; i++) {
        let e = parts[i]
        let text = i > 0 ? `@UpdatesVanguard ${e}` : e

        let parsePart = twitter.txt.parseTweet(text)
        if (parsePart.valid) newParts.push(e)
        else {

        }
      }

      parts = newParts
    } */
    let text = ''
    for (var i = 0; i < parts.length; i++) {
      let testText = text + parts[i]
      if (finalParts.length > 0) testText = `@UpdatesVanguard ${testText}`

      let parsePart = twitter.txt.parseTweet(testText)
      if (parsePart.valid) text = text + parts[i]
      else {
        finalParts.push(text)
        if (i === parts.length - 1) finalParts.push(parts[i])
        else text = parts[i]
      }
    }

    console.log(finalParts)
    twit.post('statuses/update', { status: finalParts[0] }).then(res => {
      let { data } = res
      finalParts.shift()
      nextReply(finalParts, data.id_str)
    })
  }
}

function nextReply (parts, id) {
  twit.post('statuses/update', { status: `@UpdatesVanguard ${parts[0]}`, in_reply_to_status_id: id }).then(res => {
    let { data } = res
    if (parts.length > 1) {
      parts.shift()
      nextReply(parts, data.id_str)
    }
  })
}
