const express = (require('express'))
const app = express()
const port = 3000

app.get('/api/keys', (req, res) => {

})

app.post('/api/keys/:id/check-in', (req, res) => {

})

app.post('/api/keys/:id/check-out', (req, res) => {

})

app.get('/api/history', (req, res) => {

})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
