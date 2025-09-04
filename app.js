const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const {isValid, format} = require('date-fns')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'todoApplication.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server running at http://localhost:3000/'),
    )
  } catch (error) {
    console.error(`Database Error: ${error.message}`)
  }
}
initializeDBAndServer()

const validStatus = ['TO DO', 'IN PROGRESS', 'DONE']
const validPriority = ['HIGH', 'MEDIUM', 'LOW']
const validCategory = ['WORK', 'HOME', 'LEARNING']

const convertDbObjectToResponseObject = dbObject => {
  return {
    id: dbObject.id,
    todo: dbObject.todo,
    priority: dbObject.priority,
    status: dbObject.status,
    category: dbObject.category,
    dueDate: dbObject.due_date,
  }
}

app.get('/todos/', async (request, response) => {
  const {status, priority, category, search_q = ''} = request.query

  if (status !== undefined && !validStatus.includes(status)) {
    response.status(400).send('Invalid Todo Status')
    return
  }
  if (priority !== undefined && !validPriority.includes(priority)) {
    response.status(400).send('Invalid Todo Priority')
    return
  }
  if (category !== undefined && !validCategory.includes(category)) {
    response.status(400).send('Invalid Todo Category')
    return
  }

  let conditions = []
  if (status !== undefined) {
    conditions.push(`status = '${status}'`)
  }
  if (priority !== undefined) {
    conditions.push(`priority = '${priority}'`)
  }
  if (category !== undefined) {
    conditions.push(`category = '${category}'`)
  }
  if (search_q !== '') {
    conditions.push(`todo LIKE '%${search_q}%'`)
  }

  let query = 'SELECT * FROM todo'
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  const todos = await db.all(query)
  response.send(todos.map(convertDbObjectToResponseObject))
})

app.get('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const todo = await db.get(`SELECT * FROM todo WHERE id = ${todoId};`)
  response.send(convertDbObjectToResponseObject(todo))
})

app.get('/agenda/', async (request, response) => {
  const {date} = request.query

  if (!isValid(new Date(date))) {
    response.status(400).send('Invalid Due Date')
    return
  }

  const formattedDate = format(new Date(date), 'yyyy-MM-dd')
  const todos = await db.all(
    `SELECT * FROM todo WHERE due_date = '${formattedDate}';`,
  )
  response.send(todos.map(convertDbObjectToResponseObject))
})

app.post('/todos/', async (request, response) => {
  const {id, todo, priority, status, category, dueDate} = request.body

  if (!validStatus.includes(status)) {
    response.status(400).send('Invalid Todo Status')
    return
  }
  if (!validPriority.includes(priority)) {
    response.status(400).send('Invalid Todo Priority')
    return
  }
  if (!validCategory.includes(category)) {
    response.status(400).send('Invalid Todo Category')
    return
  }
  if (!isValid(new Date(dueDate))) {
    response.status(400).send('Invalid Due Date')
    return
  }

  const formattedDate = format(new Date(dueDate), 'yyyy-MM-dd')
  const addQuery = `
    INSERT INTO todo (id, todo, priority, status, category, due_date)
    VALUES (${id}, '${todo}', '${priority}', '${status}', '${category}', '${formattedDate}');
  `
  await db.run(addQuery)
  response.send('Todo Successfully Added')
})

app.put('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const requestBody = request.body

  if (requestBody.status !== undefined) {
    if (!validStatus.includes(requestBody.status)) {
      response.status(400).send('Invalid Todo Status')
      return
    }
    await db.run(
      `UPDATE todo SET status = '${requestBody.status}' WHERE id = ${todoId};`,
    )
    response.send('Status Updated')
  } else if (requestBody.priority !== undefined) {
    if (!validPriority.includes(requestBody.priority)) {
      response.status(400).send('Invalid Todo Priority')
      return
    }
    await db.run(
      `UPDATE todo SET priority = '${requestBody.priority}' WHERE id = ${todoId};`,
    )
    response.send('Priority Updated')
  } else if (requestBody.todo !== undefined) {
    await db.run(
      `UPDATE todo SET todo = '${requestBody.todo}' WHERE id = ${todoId};`,
    )
    response.send('Todo Updated')
  } else if (requestBody.category !== undefined) {
    if (!validCategory.includes(requestBody.category)) {
      response.status(400).send('Invalid Todo Category')
      return
    }
    await db.run(
      `UPDATE todo SET category = '${requestBody.category}' WHERE id = ${todoId};`,
    )
    response.send('Category Updated')
  } else if (requestBody.dueDate !== undefined) {
    if (!isValid(new Date(requestBody.dueDate))) {
      response.status(400).send('Invalid Due Date')
      return
    }
    const formattedDate = format(new Date(requestBody.dueDate), 'yyyy-MM-dd')
    await db.run(
      `UPDATE todo SET due_date = '${formattedDate}' WHERE id = ${todoId};`,
    )
    response.send('Due Date Updated')
  }
})

app.delete('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  await db.run(`DELETE FROM todo WHERE id = ${todoId};`)
  response.send('Todo Deleted')
})

module.exports = app
