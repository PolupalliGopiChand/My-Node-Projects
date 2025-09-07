const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db');
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/');
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const SECRET_KEY = "MY_SECRET_KEY";

// Authentication Middleware
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers['authorization'];
  if (authHeader === undefined) {
    response.status(401);
    response.send('Invalid JWT Token');
  } else {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (error, payload) => {
      if (error) {
        response.status(401);
        response.send('Invalid JWT Token');
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 1: User Login with JWT Token
app.post('/login/', async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = ?`;
  const dbUser = await db.get(selectUserQuery, [username]);

  if (dbUser === undefined) {
    response.status(400);
    response.send('Invalid user');
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (isPasswordCorrect) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, SECRET_KEY);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send('Invalid password');
    }
  }
});

// API 2: Get all states
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT state_id AS stateId, state_name AS stateName, population FROM state`;
  const states = await db.all(getStatesQuery);
  response.send(states);
});

// API 3: Get state by state ID
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT state_id AS stateId, state_name AS stateName, population FROM state WHERE state_id = ?`;
  const state = await db.get(getStateQuery, [stateId]);
  response.send(state);
});

// API 4: Create a new district
app.post('/districts/', authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths) 
    VALUES (?, ?, ?, ?, ?, ?)`;
  await db.run(createDistrictQuery, [districtName, stateId, cases, cured, active, deaths]);
  response.send('District Successfully Added');
});

// API 5: Get district by district ID
app.get('/districts/:districtId/', authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `
    SELECT district_id AS districtId, district_name AS districtName, state_id AS stateId, 
           cases, cured, active, deaths 
    FROM district WHERE district_id = ?`;
  const district = await db.get(getDistrictQuery, [districtId]);
  response.send(district);
});

// API 6: Delete district by district ID
app.delete('/districts/:districtId/', authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ?`;
  await db.run(deleteDistrictQuery, [districtId]);
  response.send('District Removed');
});

// API 7: Update district by district ID
app.put('/districts/:districtId/', authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
    UPDATE district 
    SET district_name = ?, state_id = ?, cases = ?, cured = ?, active = ?, deaths = ?
    WHERE district_id = ?`;
  await db.run(updateDistrictQuery, [districtName, stateId, cases, cured, active, deaths, districtId]);
  response.send('District Details Updated');
});

// API 8: Get stats of a state by state ID
app.get('/states/:stateId/stats/', authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatsQuery = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, 
           SUM(active) AS totalActive, SUM(deaths) AS totalDeaths 
    FROM district WHERE state_id = ?`;
  const stats = await db.get(getStatsQuery, [stateId]);
  response.send(stats);
});

module.exports = app;
