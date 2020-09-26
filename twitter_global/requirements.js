const { DataTypes } = global.requireFn('sequelize')
const { STRING } = DataTypes

module.exports = (client, sequelize) => {
  sequelize.define('globalTweet', { id: { type: STRING, unique: 'index' }, user: { type: STRING, unique: 'index' } })
  sequelize.define('globalProcessed', { user: { type: STRING, primaryKey: true }, tweet: STRING })
  sequelize.define('globalApproval', { id: { type: STRING, primaryKey: true }, url: STRING })
}
