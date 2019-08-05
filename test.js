var twitter = require('twitter-text')

post()

async function post () {
  let title = `Bungie, if you know you can't fix the Invitations of the Nine Quest Step before Xur returns... force the Vex step to Auto-complete and issue a Hotfix.\n`
  let context = ['']
  let url = ` https://www.reddit.com/r/DestinyTheGame/comments/bjbztq/bungie_if_you_know_you_cant_fix_the_invitations/em8aewl/`
  let body = `(Reply by TEST): Hey all,

  At this time, we are unable to auto-complete this step of the quest. Ultimately, all players on this step will be delayed until a hotfix is issued.
  
  Stay tuned to @BungieHelp. We’ll have details on the next hotfix within the next few days. Just finalizing the details.`

  let parse = twitter.parseTweet(`${title}${context}${body}${url}`)
  if (parse.valid) twit.post('statuses/update', { status: `${title}${context}${body}${url}` })
  else {
    let parts = []
    if (twitter.parseTweet(`${title}${context}${body}`).valid) parts = [`${title}${context}${body}`, `@UpdatesVanguard ${url}`]
    else {
      if (context === '') {
        let parseTitleBody = twitter.parseTweet(`${title}${body}`)
        if (parseTitleBody.valid) parts = [`${title}${body}`, `@UpdatesVanguard ${url}`]
        else {
          let cut = parseTitleBody.validRangeEnd - 3

          parts.push(`${`${title}${body}`.substring(0, cut)}...`)

          parseBody(parts, `${title}${body}`.substring(cut), cut, url)
        }
      } else {
        let parseTitleContext = twitter.parseTweet(`${title}${context}`)
        if (parseTitleContext.valid) parts.push(`${title}${context}`)
        else parts.push(`${`${title}${context}`.substring(0, parseTitleContext.validRangeEnd - 3)}...`)

        parseBody(parts, body, 0, url)
      }
    }
    console.log(parts)
    twit.post('statuses/update', { status: parts[0] }).then(res => {
      let { data } = res
      parts.shift()
      nextReply(parts.slice(1), data.id_str)
    })
  }
}

function nextReply (parts, id) {
  twit.post('statuses/update', { status: parts[0], in_reply_to_status_id: id }).then(res => {
    let { data } = res
    if (parts.length > 1) {
      nextReply(parts.slice(1), data.id_str)
    }
  })
}
function parseBody (parts, rest, cut, url) {
  let working = true
  while (working) {
    let parseCut = twitter.parseTweet(`@UpdatesVanguard ${rest}`)
    if (parseCut.valid) {
      if (twitter.parseTweet(`@UpdatesVanguard ${rest} ${url}`).valid) parts.push(`@UpdatesVanguard ${rest} ${url}`)
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
