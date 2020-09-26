// const { log } = require('../../utilities.js')
const Snoowrap = global.requireFn('snoowrap')

var twitterText = global.requireFn('twitter-text')

module.exports = {
  async ready (client, sequelize, moduleName) {
    const { reddit, accounts, twitter, rateReddit } = client.config.reddit.config
    const twit = global.requireFn('twit')(twitter)
    const r = new Snoowrap(reddit)
    run()
    console.log('Running reddit cycles')

    function run () {
      accounts.forEach(async item => {
        const { reddit } = sequelize.models
        const { account } = item
        const proc = await reddit.findByPk(account)

        if (proc) {
          const comments = (await r.getUser(account).getComments({ before: proc.id })).sort(function (a, b) { return a.created - b.created })
          if (comments.length > 0) {
            console.log(`${account}: ${comments.length} tweets`)
            proc.id = `t1_${comments[comments.length - 1].id}`
            await proc.save()

            comments.forEach(comment => {
              if (!item.allowed || item.allowed.includes(comment.subreddit.display_name)) post(comment, item)
            })
          }
        } else {
          const res = await r.getUser(account).getComments({ limit: 1 })
          if (res[0]) {
            await reddit.create({ user: res[0].author.name, id: `t1_${res[0].id}` })
          }
          console.log(`Synced ${res[0].author.name}`)

          refresh(run)
        }
      })

      refresh(run)
    }

    function refresh (run) {
      setTimeout(run, rateReddit)
    }

    async function post (comment, item) {
      console.log(comment)
      const title = `${comment.link_title}\n`
      const context = `${comment.parent_id.startsWith('t1') ? `"${await r.getComment(comment.parent_id.split('_')[1]).body}"\n` : ''}`
      const url = ` https://reddit.com${comment.permalink}`
      const body = `(Reply by ${comment.author.name}): ${comment.body}`

      const parse = twitterText.parseTweet(`${title}${context}${body}${url}`)
      if (parse.valid) twit.post('statuses/update', { status: `${title}${context}${body}${url}` })
      else {
        let parts = []
        if (twitterText.parseTweet(`${title}${context}${body}`).valid) parts = [`${title}${context}${body}`, `@UpdatesVanguard ${url}`]
        else {
          if (context === '') {
            const parseTitleBody = twitterText.parseTweet(`${title}${body}`)
            if (parseTitleBody.valid) parts = [`${title}${body}`, `@UpdatesVanguard ${url}`]
            else {
              const cut = parseTitleBody.validRangeEnd - 3

              parts.push(`${`${title}${body}`.substring(0, cut)}...`)

              parseBody(parts, `${title}${body}`.substring(cut), cut, url)
            }
          } else {
            const parseTitleContext = twitterText.parseTweet(`${title}${context}`)
            if (parseTitleContext.valid) parts.push(`${title}${context}`)
            else parts.push(`${`${title}${context}`.substring(0, parseTitleContext.validRangeEnd - 3)}...`)

            parseBody(parts, body, 0, url)
          }
        }
        console.log(parts)
        twit.post('statuses/update', { status: parts[0] }).then(res => {
          const { data } = res
          nextReply(parts.slice(1), data.id_str)
        })
      }
    }

    function nextReply (parts, id) {
      twit.post('statuses/update', { status: parts[0], in_reply_to_status_id: id }).then(res => {
        const { data } = res
        if (parts.length > 1) {
          nextReply(parts.slice(1), data.id_str)
        }
      })
    }
    function parseBody (parts, rest, cut, url) {
      let working = true
      while (working) {
        const parseCut = twitterText.parseTweet(`@UpdatesVanguard ${rest}`)
        if (parseCut.valid) {
          if (twitterText.parseTweet(`@UpdatesVanguard ${rest} ${url}`).valid) parts.push(`@UpdatesVanguard ${rest} ${url}`)
          else {
            parts.push(`@UpdatesVanguard ${rest}`)
            parts.push(`@UpdatesVanguard ${url}`)
          }
          working = false
        } else {
          cut = parseCut.validRangeEnd - 3
          rest = `@UpdatesVanguard ${rest}`.substring(cut)
          parts.push(`${`@UpdatesVanguard ${rest}`.substring(0, cut)}...`)
        }
      }
    }
  }
}
