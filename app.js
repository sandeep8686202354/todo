const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
let database = null

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const initilizationDbAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('server running at http://localhost:3000'),
    )
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initilizationDbAndServer()

convertStateDbObjectToResponseDb = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
convertDistrictDbObectToResponseDbObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.districtName,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}
app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const selectUserQuery = `

    SELECT
    * 
    FROM
    user 
    WHERE 
    username = "${username}";
    `
  const selectUser = await database.get(selectUserQuery)

  if (selectUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      selectUser.password,
    )
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT 
     * 
  FROM
    state
  ORDER BY 
  state_id`

  const statesAray = await database.all(getStatesQuery)
  response.send(statesAray.map(i => convertStateDbObjectToResponseDb(i)))
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT * 
  FROM state 
  WHERE state_id = "${stateId}"
  `
  const stateQuery = await database.get(getStateQuery)
  response.send(stateQuery)
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const getDistrictPostQuery = `
  INSERT INTO 
   district(district_name, state_id, cases, cured, active, deaths)
   VALUES (
    "${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}
   );`

  await database.run(getDistrictPostQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
  SELECT
   *
  FROM 
   district 
  WHERE 
   district_id = ${districtId};`
    const getDistrict = await database.get(getDistrictQuery)
    response.send(convertDistrictDbObjectToResponseDb(getDistrict))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDeleteQuery = `
  SELECT 
   * 
  FROM
   district 
  WHERE 
  district_id = ${districtId};`
    await dbPath.run(getDeleteQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const putDistrictQuery = `
  UPDATE
   * 
  FROM 
    district 
  SET 
   district_name = "${districtName}",

   state_id = ${stateId},
   cases = ${cases},
   cured = ${cured},
   active = ${active},
   deaths = ${deaths}
   WHERE 
    district_id = ${districtId};
   `
    await database.run(putDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params;
    const getStatesStateQuery = `
    SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalactive,
    SUM(deaths) as totalDeaths
    
    FROM 
     district 
     WHERE 
      state_id = ${stateId};
     `;
     const state = await database.get(getStatesStateQuery);
     response.send({
      totalCases: state["totalacases"],
      totalCured: state["totalCured"],
      totalActive: state["totalActive"],
      totalDeaths: state["totalDeaths"]
     }
      
     );


  }
);

module.exports = app;
