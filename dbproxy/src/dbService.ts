import mysql from 'mysql';
import _ from 'lodash';
import {convertTypeMySQL, delay, getFieldTypeSchema, getSchema, convertTypeSchema, wrapString} from './utility.js';

// Main class for interacting with the database
export class DBService {
    private schema: { tables: {name: string, columns: {name: string, type: string}[] }[] };
    private dbCon: mysql.Connection;
    readonly serviceReady: Promise<void>;
    // Constructor makes sure the connection to the database is established, then runs schema validation
    constructor() {
        this.serviceReady = new Promise<void>(async (resolve, reject) => {
            let connectionTries = 0;
            let successfulConnect = false;
            while (connectionTries < 5) {
                connectionTries++;
                try {
                    await this.tryConnect();
                    successfulConnect = true;
                    break;
                } catch (e) {
                    if (connectionTries < 5) {
                        console.error("Could not connect to database, trying again in 10 seconds. Attempt #", connectionTries);
                        await delay(10000);
                    }
                }
            }
            if (successfulConnect) {
                // Import schema
                this.schema = getSchema();
                await this.validateSchema();
                resolve();
            } else {
                reject(new Error("Could not connect to MySQL Container"));
            }
        });
    }

    // Attempt database connection
    private tryConnect() {
        return new Promise<void>((resolve, reject) => {
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
                    resolve();
                }
            });
        });
    }

    // Compares provided schema.json to current database schema and fixes the latter to match the former
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

    // Compares schema.json to db for tables and finds the ones to delete and the ones to add
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
        return columns.map(convertTypeSchema);
    }

    // Compares schema.json to db for columns in a given table and finds the ones to delete and the ones to add
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
        let columnQuery = table.columns.map(column => `${column.name} ${convertTypeMySQL(column.type)}`).join(', ');
        const query = `CREATE TABLE ${table.name} (id INT NOT NULL AUTO_INCREMENT, ${columnQuery}, PRIMARY KEY (id));`;
        await this.query(query);
    }

    async dropTable(tableName: string) {
        const query = `DROP TABLE ${tableName};`;
        await this.query(query);
    }

    async createColumn(tableName: string, column: {name: string, type: string}) {
        const query = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${convertTypeMySQL(column.type)};`
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
                    console.error('Query failed');
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
        let error: string = null;
        Object.keys(entry).forEach(colName => {
            columns.push(colName);
            let value = entry[colName];
            try {
                if (getFieldTypeSchema(this.schema, tableName, colName) === 'string')
                    value = wrapString(value);
                values.push(value);
            } catch (e) {
                error = `Invalid name or type for column: ${colName}`;
            }
        });
        if (error) return error;
        const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${values.join(',')});`;
        try {
            const response = await this.query(query);
            return {
                "message": "Successful creation",
                "insertId": response.insertId
            };
        } catch (e) {
            return "Could not create";
        }
    }

    async read(tableName: string, id: string) {
        const query = `SELECT * FROM ${tableName} WHERE id = ${id} LIMIT 1;`;
        try {
            return await this.query(query);
        } catch (e) {
            return "Could not read";
        }
    }

    async update(tableName: string, id: string, entry: object) {
        let error = null;
        const valueQuery = Object.keys(entry).map(colName => {
            let value = entry[colName];
            try {
                const isString = getFieldTypeSchema(this.schema, tableName, colName) === 'string';
                if (isString)
                    value = wrapString(value);
                return `${colName} = ${value}`
            } catch (e) {
                error = `Invalid name or type for column: ${colName}`;
            }
        }).join(', ');
        if (error)
            return error;
        const query = `UPDATE ${tableName} SET ${valueQuery} WHERE id = ${id};`;
        try {
            const response = await this.query(query);
            return {
                "message": "Successful update"
            };
        } catch (e) {
            return "Could not update";
        }
    }

    async delete(tableName: string, id: string) {
        const query = `DELETE FROM ${tableName} WHERE id = ${id}`;
        try {
            await this.query(query);
            return {
                "message": "Successful deletion"
            };
        } catch (e) {
            return "Could not delete";
        }
    }

}
