import dotenv from 'dotenv';
import express from 'express';
import * as path from 'path';
import {fileURLToPath} from 'url';
import * as http from 'http';
import { DBService } from './dbService.js';

// Import .env from root directory, it has to be there to work with docker too
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({path: path.join(__dirname, '..', '..', '.env')});

const app = express();
app.use(express.json());
const server = http.createServer(app);

const dbService = new DBService();

// Await db connection before starting server
try {
    await dbService.connectPromise;
    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    app.get('/:test', (req, res) => {
        res.send(req.params);
    });

    app.post('/:collection', async (req, res) => {
        res.send(await dbService.create(req.params.collection, req.body));
    });
    app.get('/:collection/:id', async (req, res) => {
        res.send(await dbService.read(req.params.collection, req.params.id));
    });
    app.post('/:collection/:id', async (req, res) => {
        res.send(await dbService.update(req.params.collection, req.params.id, req.body));
    });
    app.delete('/:collection/:id', async (req, res) => {
        res.send(await dbService.delete(req.params.collection, req.params.id));
    });

    const port = Number(process.env.DBPROXY_PORT);
    server.listen(port, () => {
        console.log('Listening on port', port);
    });
} catch (e) {
    console.log(e);
}
