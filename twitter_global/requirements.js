const { DataTypes } = global.requireFn('sequelize')
const { STRING } = DataTypes

module.exports = (client, sequelize) => {
  sequelize.define('globalTweet', { tweet: { type: STRING, primaryKey: true }, user: STRING })
  sequelize.define('globalProcessed', { user: { type: STRING, primaryKey: true }, tweet: STRING })
  sequelize.define('globalApproval', { id: { type: STRING, primaryKey: true }, url: STRING })
}
