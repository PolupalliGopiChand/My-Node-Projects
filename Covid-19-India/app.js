const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19India.db')
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

// API 1: Get all states
app.get('/states/', async (req, res) => {
  try {
    const query = `SELECT state_id AS stateId, state_name AS stateName, population FROM state`
    const states = await db.all(query)
    res.status(200).json(states)
  } catch (error) {
    res.status(500).send('Error fetching states')
  }
})

// API 2: Get state by ID
app.get('/states/:stateId/', async (req, res) => {
  try {
    const {stateId} = req.params
    const query = `SELECT state_id AS stateId, state_name AS stateName, population FROM state WHERE state_id = ?`
    const state = await db.get(query, stateId)
    res.status(200).json(state)
  } catch (error) {
    res.status(500).send('Error fetching state')
  }
})

// API 3: Create a district
app.post('/districts/', async (req, res) => {
  try {
    const {districtName, stateId, cases, cured, active, deaths} = req.body
    const query = `
      INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    await db.run(query, districtName, stateId, cases, cured, active, deaths)
    res.status(200).send('District Successfully Added')
  } catch (error) {
    res.status(500).send('Error adding district')
  }
})

// API 4: Get district by ID
app.get('/districts/:districtId/', async (req, res) => {
  try {
    const {districtId} = req.params
    const query = `
      SELECT district_id AS districtId, district_name AS districtName, state_id AS stateId, cases, cured, active, deaths
      FROM district
      WHERE district_id = ?
    `
    const district = await db.get(query, districtId)
    res.status(200).json(district)
  } catch (error) {
    res.status(500).send('Error fetching district')
  }
})

// API 5: Delete district by ID
app.delete('/districts/:districtId/', async (req, res) => {
  try {
    const {districtId} = req.params
    const query = `DELETE FROM district WHERE district_id = ?`
    await db.run(query, districtId)
    res.status(200).send('District Removed')
  } catch (error) {
    res.status(500).send('Error deleting district')
  }
})

// API 6: Update district by ID
app.put('/districts/:districtId/', async (req, res) => {
  try {
    const {districtId} = req.params
    const {districtName, stateId, cases, cured, active, deaths} = req.body
    const query = `
      UPDATE district
      SET district_name = ?, state_id = ?, cases = ?, cured = ?, active = ?, deaths = ?
      WHERE district_id = ?
    `
    await db.run(
      query,
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    )
    res.status(200).send('District Details Updated')
  } catch (error) {
    res.status(500).send('Error updating district')
  }
})

// API 7: Get statistics of a state
app.get('/states/:stateId/stats/', async (req, res) => {
  try {
    const {stateId} = req.params
    const query = `
      SELECT 
        SUM(cases) AS totalCases, 
        SUM(cured) AS totalCured, 
        SUM(active) AS totalActive, 
        SUM(deaths) AS totalDeaths
      FROM district WHERE state_id = ?
    `
    const stats = await db.get(query, stateId)
    res.status(200).json(stats)
  } catch (error) {
    res.status(500).send('Error fetching state statistics')
  }
})

// API 8: Get state name for a district
app.get('/districts/:districtId/details/', async (req, res) => {
  try {
    const {districtId} = req.params
    const query = `
      SELECT state.state_name AS stateName
      FROM district
      JOIN state ON district.state_id = state.state_id
      WHERE district.district_id = ?
    `
    const result = await db.get(query, districtId)
    res.status(200).json(result)
  } catch (error) {
    res.status(500).send('Error fetching state details')
  }
})

module.exports = app
