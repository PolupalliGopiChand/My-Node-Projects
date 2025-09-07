const express = require('express')
const path = require('path')

const app = express()
app.use(express.json())

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const dbPath = path.join(__dirname, 'moviesData.db')

let db = null

const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDatabaseAndServer()

// GET Movies API
app.get('/movies/', async (request, response) => {
  const getMoviesQuery = `SELECT movie_name as movieName FROM movie;`
  const moviesArray = await db.all(getMoviesQuery)
  response.send(moviesArray)
})

// POST Movies API
app.post('/movies/', async (request, response) => {
  const {directorId, movieName, leadActor} = request.body
  const addMoviesQuery = `INSERT INTO movie (director_id, movie_name, lead_actor) VALUES (?, ?, ?);`
  await db.run(addMoviesQuery, directorId, movieName, leadActor)
  response.send('Movie Successfully Added')
})

// GET Movie by ID API
app.get('/movies/:movieId/', async (request, response) => {
  const {movieId} = request.params
  const getMovieQuery = `SELECT * FROM movie WHERE movie_id = ?;`
  const movie = await db.get(getMovieQuery, movieId)
  if (movie) {
    const {movie_id, director_id, movie_name, lead_actor} = movie
    const dbResponse = {
      movieId: movie_id,
      directorId: director_id,
      movieName: movie_name,
      leadActor: lead_actor,
    }
    response.send(dbResponse)
  } else {
    response.status(404).send('Movie not found')
  }
})

// PUT Movie by ID API
app.put('/movies/:movieId/', async (request, response) => {
  const {movieId} = request.params
  const {directorId, movieName, leadActor} = request.body
  const updateMovieQuery = `UPDATE movie SET director_id = ?, movie_name = ?, lead_actor = ? WHERE movie_id = ?;`
  await db.run(updateMovieQuery, directorId, movieName, leadActor, movieId)
  response.send('Movie Details Updated')
})

// DELETE Movie by ID API
app.delete('/movies/:movieId/', async (request, response) => {
  const {movieId} = request.params
  const deleteMovieQuery = `DELETE FROM movie WHERE movie_id = ?;`
  await db.run(deleteMovieQuery, movieId)
  response.send('Movie Removed')
})

// GET Directors API
app.get('/directors/', async (request, response) => {
  const getMoviesQuery = `SELECT director_id as directorId, director_name as directorName FROM director;`
  const moviesArray = await db.all(getMoviesQuery)
  response.send(moviesArray)
})

// GET Movies by Director API
app.get('/directors/:directorId/movies/', async (request, response) => {
  const {directorId} = request.params
  const getMovieNamesQuery = `SELECT movie_name as movieName FROM movie WHERE director_id = ?;`
  const movieNamesArray = await db.all(getMovieNamesQuery, directorId)
  response.send(movieNamesArray)
})

module.exports = app
