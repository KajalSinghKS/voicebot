const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => res.send({ status: 'ok' }));

app.listen(5000, () => console.log('Server running on port 5000'));
