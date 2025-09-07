const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = 'twitterClone.db'
let db = null

// Middleware for connecting to the database
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    console.log('Database connected successfully')
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (authHeader === undefined) {
    return res.status(401).send('Invalid JWT Token')
  }
  const jwtToken = authHeader.split(' ')[1]
  jwt.verify(jwtToken, 'SECRET_KEY', (error, payload) => {
    if (error) {
      return res.status(401).send('Invalid JWT Token')
    }
    req.username = payload.username
    next()
  })
}

// Start database and server
initializeDBAndServer()

// Helper function to get user ID from username
const getUserId = async username => {
  const userQuery = `SELECT user_id FROM user WHERE username = ?`
  const user = await db.get(userQuery, [username])
  return user.user_id
}

// API 1: Get all tweets of the user
app.get('/user/tweets/', authenticateToken, async (req, res) => {
  const userId = await getUserId(req.username)
  const tweetsQuery = `
    SELECT tweet_id, tweet, date_time AS dateTime 
    FROM tweet 
    WHERE user_id = ? 
    ORDER BY date_time DESC;
  `
  const tweets = await db.all(tweetsQuery, [userId])
  res.send(tweets)
})

// API 2: Get latest tweets of followed users (Feed)
app.get('/user/tweets/feed/', authenticateToken, async (req, res) => {
  const userId = await getUserId(req.username)
  const tweetsQuery = `
    SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
    FROM tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    JOIN user ON user.user_id = tweet.user_id
    WHERE follower.follower_user_id = ?
    ORDER BY tweet.date_time DESC
    LIMIT 4;
  `
  const tweets = await db.all(tweetsQuery, [userId])
  res.send(tweets)
})

// API 3: Get tweet likes
app.get('/tweets/:tweetId/likes/', authenticateToken, async (req, res) => {
  const {tweetId} = req.params
  const userId = await getUserId(req.username)

  const isFollowingQuery = `
    SELECT *
    FROM tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    WHERE tweet.tweet_id = ? AND follower.follower_user_id = ?;
  `
  const isFollowing = await db.get(isFollowingQuery, [tweetId, userId])

  if (isFollowing === undefined) {
    return res.status(401).send('Invalid Request')
  }

  const likesQuery = `
    SELECT user.username 
    FROM like
    JOIN user ON user.user_id = like.user_id
    WHERE like.tweet_id = ?;
  `
  const likes = await db.all(likesQuery, [tweetId])
  res.send(likes)
})

// API 4: Get tweet replies
app.get('/tweets/:tweetId/replies/', authenticateToken, async (req, res) => {
  const {tweetId} = req.params
  const userId = await getUserId(req.username)

  const isFollowingQuery = `
    SELECT *
    FROM tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    WHERE tweet.tweet_id = ? AND follower.follower_user_id = ?;
  `
  const isFollowing = await db.get(isFollowingQuery, [tweetId, userId])

  if (isFollowing === undefined) {
    return res.status(401).send('Invalid Request')
  }

  const repliesQuery = `
    SELECT reply.reply, user.username AS repliedBy
    FROM reply
    JOIN user ON user.user_id = reply.user_id
    WHERE reply.tweet_id = ?;
  `
  const replies = await db.all(repliesQuery, [tweetId])
  res.send({tweetId, replies})
})

// API 5: Post a new tweet
app.post('/user/tweets/', authenticateToken, async (req, res) => {
  const {tweet} = req.body
  const userId = await getUserId(req.username)
  const dateTime = new Date().toISOString()

  const createTweetQuery = `
    INSERT INTO tweet (tweet, user_id, date_time)
    VALUES (?, ?, ?);
  `
  await db.run(createTweetQuery, [tweet, userId, dateTime])
  res.status(201).send('Created a Tweet')
})

// API 6: Register User
app.post('/register/', async (req, res) => {
  const {username, password, name, gender} = req.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const userQuery = `SELECT * FROM user WHERE username = ?`
  const user = await db.get(userQuery, [username])

  if (user !== undefined) {
    res.status(400).send('User already exists')
  } else if (password.length < 6) {
    res.status(400).send('Password is too short')
  } else {
    const createUserQuery = `
      INSERT INTO user (name, username, password, gender)
      VALUES (?, ?, ?, ?);
    `
    await db.run(createUserQuery, [name, username, hashedPassword, gender])
    res.status(200).send('User created successfully')
  }
})

// API 7: Login User
app.post('/login/', async (req, res) => {
  const {username, password} = req.body
  const userQuery = `SELECT * FROM user WHERE username = ?`
  const user = await db.get(userQuery, [username])

  if (user === undefined) {
    res.status(400).send('Invalid user')
  } else {
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (isPasswordValid) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'SECRET_KEY')
      res.status(200).send({jwtToken})
    } else {
      res.status(400).send('Invalid password')
    }
  }
})

// API 8: Get list of followed users
app.get('/user/following/', authenticateToken, async (req, res) => {
  const userId = await getUserId(req.username)
  const followingQuery = `
    SELECT user.name
    FROM follower
    JOIN user ON user.user_id = follower.following_user_id
    WHERE follower.follower_user_id = ?;
  `
  const following = await db.all(followingQuery, [userId])
  res.send(following)
})

// API 9: Get list of followers
app.get('/user/followers/', authenticateToken, async (req, res) => {
  const userId = await getUserId(req.username)
  const followersQuery = `
    SELECT user.name
    FROM follower
    JOIN user ON user.user_id = follower.follower_user_id
    WHERE follower.following_user_id = ?;
  `
  const followers = await db.all(followersQuery, [userId])
  res.send(followers)
})

// API 10: Delete tweet
app.delete('/tweets/:tweetId/', authenticateToken, async (req, res) => {
  const {tweetId} = req.params
  const userId = await getUserId(req.username)

  const tweetQuery = `SELECT * FROM tweet WHERE tweet_id = ?`
  const tweet = await db.get(tweetQuery, [tweetId])

  if (tweet === undefined || tweet.user_id !== userId) {
    return res.status(401).send('Invalid Request')
  }

  const deleteQuery = `DELETE FROM tweet WHERE tweet_id = ?`
  await db.run(deleteQuery, [tweetId])
  res.status(200).send('Tweet Removed')
})

module.exports = app
