const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const createError = require('http-errors')

const app = express();
const PORT = 3000;

const CONFIG = process.argv.slice(2)[0] || 'config.yaml';

let config;

try {
  config = yaml.load(
    fs.readFileSync(path.join(__dirname, CONFIG), 'utf8')
  );
} catch (error) {
  console.error('Error reading or parsing config:', error);
  process.exit(1);
}

app.use(express.json());

function checkRoute(req, res, next) {
  const route = req.params.route;

  if (!config.routes.includes(route)) {
    return res.status(404).json({
      error: `Route ${route} not found`
    });
  }

  next();
}

function saveConfig() {
  const configPath = path.join(__dirname, CONFIG);

  fs.writeFileSync(
    configPath,
    yaml.dump(config, 'utf8')
  );
}

function applyEmbed(route, data, embed, embedName, idSearch) {
  if (!embed) {
    return data;
  }

  const relationship = config.relationships[route].find(r => r.relatedRoute === embed);
  if (!relationship) {
    return data;
  }

  const fk = relationship.foreignKey;
  const embedData = config[embed] || [];

  if (!Array.isArray(data)) {
    data = [data];
  }

  const result = [];
  if (embedName) {
    data.forEach(i => result.push({...i, [embedName]: embedData.filter(e => i[fk].includes(e.id))}));
  } else {
    data.forEach(i => result.push({...i, [embed]: embedData.filter(e => i[fk].includes(e.id))}));
  }
  return idSearch ? result[0] : result;
}

app.get('/', (req, res) => {
  res.send(`Configured routes: ${config.routes}`);
});

app.get('/:route', checkRoute, (req, res) => {
  const route = req.params.route;
  const data = config[route] || [];
  const embed = req.query.embed || null;
  const embedName = req.query.embedName || null;

  res.json(applyEmbed(route, data, embed, embedName, false));
});

app.get('/:route/:id', checkRoute, (req, res) => {
  const route = req.params.route;
  const id = req.params.id;
  const data = config[route] || [];
  const embed = req.query.embed || null;
  const embedName = req.query.embedName || null;

  const record = data.find(item => item.id == id);

  if (!record) {
    return res.status(404).json({
      error: `Record with ID ${id} not found in ${route}`
    });
  }

  res.json(applyEmbed(route, record, embed, embedName, true));
});

app.post('/:route', checkRoute, (req, res, next) => {
  const route = req.params.route;
  config[route].push(req.body);

  try {
    saveConfig();
    res.status(200).json({res: "Record created with ID " + req.body.id});
  } catch (error) {
    res.status(500).json("failed to create record")
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

const shutdown = () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
