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

// Set up express
const app = express();
const port = Number(process.env.DBPROXY_PORT);
const server = http.createServer(app);

const dbService = new DBService();

// Await connection before starting server
try {
    await dbService.connectPromise;
    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    server.listen(port, () => {
        console.log('Listening on port', port);
    });
} catch (e) {
    console.log(e);
}
