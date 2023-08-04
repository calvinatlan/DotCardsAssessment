import * as path from 'path';
import * as fs from 'fs';
import {fileURLToPath} from 'url';
import mysql from 'mysql';
import _ from 'lodash';
import {getColumnTypeQuery, getFieldTypeSchema, sqlColumnToSchema} from './utility.js';

export class DBService {
    private schema: { tables: {name: string, columns: {name: string, type: string}[] }[] };
    private dbCon: mysql.Connection;
    readonly connectPromise: Promise<void>;
    constructor() {
        this.connectPromise = new Promise((resolve, reject) => {
            // Import schema
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const schemaFilePath = path.join(__dirname, '..', '..', 'schema.json');
            const rawData = fs.readFileSync(schemaFilePath);
            this.schema = JSON.parse(rawData.toString());
            // Connect to db
            this.dbCon = mysql.createConnection({
                host: 'host.docker.internal',
                user: 'root',
                password: process.env.DB_PASSWORD,
                database: process.env.MYSQL_DATABASE
            });
            this.dbCon.connect(async err => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database connection established.');
                    await this.validateSchema();
                    resolve();
                }
            });
        });
    }

    private async validateSchema() {
        let tableNames = await this.readTableNames();
        tableNames = tableNames.map(rowObject => Object.values(rowObject)[0]);
        let schemaTableNames = this.schema.tables.map(table => table.name);
        if (!_.isEqual(tableNames, schemaTableNames)) await this.fixTables(schemaTableNames, tableNames);

        // Not using forEach because it doesn't play nice with async/await
        for (const table of this.schema.tables) {
            const columns = await this.readColumns(table.name);
            let schemaColumns = table.columns;
            schemaColumns = [
                ...schemaColumns,
                {name: 'id', type: 'integer'}
            ]
            if (!_.isEqual(columns, schemaColumns)) {
                await this.fixColumns(table.name, schemaColumns, columns);
            }
        }
    }

    async readTableNames(): Promise<string[]> {
        const query = 'SHOW TABLES;';
        return this.query(query);
    }

    async fixTables(schemaTableNames: string[], tableNames: string[]) {
        const toRemove = _.difference(tableNames, schemaTableNames);
        for (const name of toRemove) {
            await this.dropTable(name);
        }
        const toAddNames = _.difference(schemaTableNames, tableNames);
        const toAdd = this.schema.tables.filter(table => toAddNames.includes(table.name));
        for (const table of toAdd) {
            await this.createTable(table);
        }
    }

    async readColumns(tableName: string): Promise<{name: string, type: string}[]> {
        const query = `SHOW COLUMNS FROM ${tableName}`;
        const columns = await this.query(query);
        return columns.map(sqlColumnToSchema);
    }

    async fixColumns(tableName: string, schemaColumns: {name: string, type: string}[], columns: {name: string, type: string}[]) {
        const toRemove = _.differenceWith(columns, schemaColumns, _.isEqual);
        for (const column of toRemove) {
            await this.dropColumn(tableName, column)
        }
        const toAdd = _.differenceWith(schemaColumns, columns, _.isEqual);
        for (const column of toAdd) {
            await this.createColumn(tableName, column);
        }
    }

    async createTable(table: {name: string, columns: {name: string, type: string}[]}) {
        let columnQuery = table.columns.map(column => `${column.name} ${getColumnTypeQuery(column.type)}`).join(', ');
        const query = `CREATE TABLE ${table.name} (id INT NOT NULL AUTO_INCREMENT, ${columnQuery}, PRIMARY KEY (id));`;
        await this.query(query);
    }

    async dropTable(tableName: string) {
        const query = `DROP TABLE ${tableName};`;
        await this.query(query);
    }

    async createColumn(tableName: string, column: {name: string, type: string}) {
        const query = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${getColumnTypeQuery(column.type)};`
        await this.query(query);
    }

    async dropColumn(tableName: string, column: {name: string}) {
        const query = `ALTER TABLE ${tableName} DROP COLUMN ${column.name};`;
        await this.query(query);
    }

    // ----Query Helper ---- //

    async query(query: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.dbCon.query(query, (err, result) => {
                console.log('Executing query:', query);
                if (err) {
                    console.log('Query failed');
                    reject(err);
                } else {
                    console.log('Query succeeded');
                    resolve(JSON.parse(JSON.stringify(result)));
                }
            });
        });
    }

    // ----Route Handlers---- //

    async create(tableName: string, entry: object) {
        const columns = [];
        const values = [];
        console.log(typeof entry);
        console.log(entry);
        Object.keys(entry).forEach(colName => {
            columns.push(colName);
            let value = entry[colName];
            if (getFieldTypeSchema(this.schema, tableName, colName) === 'string')
                value = '"' + value + '"';
            values.push(value);
        });
        const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${values.join(',')});`;
        try {
            return await this.query(query);
        } catch (e) {
            return e;
        }
    }

    async read(tableName: string, id: string) {
        const query = `SELECT * FROM ${tableName} WHERE id = ${id} LIMIT 1;`;
        try {
            return await this.query(query);
        } catch (e) {
            return e;
        }
    }

    async update(tableName: string, id: string, entry: object) {
        const valueQuery = Object.keys(entry).map(colName => {
            let value = entry[colName];
            const isString = getFieldTypeSchema(this.schema, tableName, colName) === 'string';
            if (isString)
                value = '"' + value + '"';
            return `${colName} = ${value}`
        }).join(', ');
        const query = `UPDATE ${tableName} SET ${valueQuery} WHERE id = ${id};`;
        try {
            return await this.query(query);
        } catch (e) {
            return e;
        }
    }

    async delete(tableName: string, id: string) {
        const query = `DELETE FROM ${tableName} WHERE id = ${id}`;
        try {
            return await this.query(query);
        } catch (e) {
            return e;
        }
    }

}
