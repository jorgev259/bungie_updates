const { DataTypes } = global.requireFn('sequelize')
module.exports = (client, sequelize) => {
  sequelize.define('reddit', {
    user: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    id: DataTypes.STRING
  })
}

/*
  Listing [
  Comment {
    total_awards_received: 0,
    approved_at_utc: null,
    edited: false,
    mod_reason_by: null,
    banned_by: null,
    author_flair_type: 'richtext',
    removal_reason: null,
    link_id: 't3_fyq7fz',
    author_flair_template_id: null,
    likes: null,
    replies: Listing [],
    user_reports: [],
    saved: false,
    id: 'fn1hw4z',
    banned_at_utc: null,
    mod_reason_title: null,
    gilded: 0,
    archived: false,
    no_follow: true,
    author: RedditUser { name: 'Cozmo23' },
    num_comments: 7,
    can_mod_post: false,
    created_utc: 1586562354,
    send_replies: true,
    parent_id: 't1_fn18sc0',
    score: 1,
    author_fullname: 't2_53rki',
    over_18: false,
    treatment_tags: [],
    approved_by: null,
    mod_note: null,
    all_awardings: [],
    subreddit_id: 't5_2vq0w',
    body: "We're currently working on it. We'll share any details when we know more.",
    link_title: 'Error code: Watercress',
    author_flair_css_class: 'SS6 5-7 Verified-Bungie-Employee',
    name: 't1_fn1hw4z',
    author_patreon_flair: false,
    downs: 0,
    author_flair_richtext: [ { e: 'text', t: 'Bungie Community Manager' } ],
    is_submitter: false,
    body_html: '<div class="md"><p>We&#39;re currently working on it. We&#39;ll share any details when we know more.</p>\n' +
      '</div>',
    gildings: {},
    collapsed_reason: null,
    distinguished: null,
    associated_award: null,
    stickied: false,
    author_premium: true,
    can_gild: true,
    subreddit: Subreddit { display_name: 'DestinyTheGame' },
    author_flair_text_color: 'dark',
    score_hidden: false,
    permalink: '/r/DestinyTheGame/comments/fyq7fz/error_code_watercress/fn1hw4z/',
    num_reports: null,
    link_permalink: 'https://www.reddit.com/r/DestinyTheGame/comments/fyq7fz/error_code_watercress/',
    report_reasons: null,
    link_author: 'LaPiscinaDeLaMuerte',
    subreddit_name_prefixed: 'r/DestinyTheGame',
    author_flair_text: 'Bungie Community Manager',
    link_url: 'https://www.reddit.com/r/DestinyTheGame/comments/fyq7fz/error_code_watercress/',
    created: 1586591154,
    collapsed: false,
    awarders: [],
    controversiality: 0,
    locked: false,
    author_flair_background_color: '',
    collapsed_because_crowd_control: null,
    mod_reports: [],
    quarantine: false,
    subreddit_type: 'public',
    ups: 1
  }
]
*/
