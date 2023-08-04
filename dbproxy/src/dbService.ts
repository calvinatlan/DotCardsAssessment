import * as path from 'path';
import * as fs from 'fs';
import {fileURLToPath} from 'url';
import mysql from 'mysql';
import _ from 'lodash';
import {getColumnTypeQuery} from './utility.js';

export class DBService {
    private schema: { tables: {name: string, columns: {name: string, type: string}[], primaryKey: string}[] };
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
            const schemaColumns = table.columns;
            if (!_.isEqual(columns, schemaColumns)) {
                const keyQuery = `SHOW KEYS FROM ${table.name} WHERE Key_name = 'PRIMARY';`
                const keyResult = await this.query(keyQuery);
                const oldPrimaryKey = keyResult[0] ? keyResult[0]['Column_name'] : null;
                await this.fixColumns(table.name, oldPrimaryKey, table.primaryKey, schemaColumns, columns);
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
        const sqlColumnToSchema = (column: {Field: string, Type: string}) => {
            let colType: string;
            switch(true) {
                case /int/.test(column.Type): colType = 'integer'; break;
                case /varchar/.test(column.Type): colType = 'string'; break;
                default: colType = 'string'; break;
            }
            return {
                'name': column.Field,
                'type': colType
            }
        }
        const query = `SHOW COLUMNS FROM ${tableName}`;
        const columns = await this.query(query);
        return columns.map(sqlColumnToSchema);
    }

    async fixColumns(tableName: string, oldPrimaryKey: string, newPrimaryKey: string, schemaColumns: {name: string, type: string}[], columns: {name: string, type: string}[]) {
        const toRemove = _.differenceWith(columns, schemaColumns, _.isEqual);
        for (const column of toRemove) {
            await this.dropColumn(tableName, column, oldPrimaryKey)
        }
        const toAdd = _.differenceWith(schemaColumns, columns, _.isEqual);
        for (const column of toAdd) {
            await this.createColumn(tableName, column, newPrimaryKey === column.name);
        }
    }

    async createTable(table: {name: string, columns: {name: string, type: string}[], primaryKey: string}) {
        let columnQuery = table.columns.map(column => `${column.name} ${getColumnTypeQuery(column.type)}`).join(', ');
        if (table.primaryKey) {
            columnQuery += `, PRIMARY KEY (${table.primaryKey})`;
        }
        const query = `CREATE TABLE ${table.name} (${columnQuery});`;
        await this.query(query);
    }

    async dropTable(tableName: string) {
        const query = `DROP TABLE ${tableName};`;
        await this.query(query);
    }

    async createColumn(tableName: string, column: {name: string, type: string}, isPrimaryKey: boolean) {
        const query = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${getColumnTypeQuery(column.type)};`
        await this.query(query);
        if (isPrimaryKey) {
            const keyQuery = `ALTER TABLE ${tableName} ADD PRIMARY KEY (${column.name});`;
            await this.query(keyQuery);
        }
    }

    async dropColumn(tableName: string, column: {name: string}, primaryKey: string) {
        if (primaryKey && column.name === primaryKey) {
            const keyQuery = `ALTER TABLE ${tableName} DROP PRIMARY KEY`;
            await this.query(keyQuery);
        }
        const query = `ALTER TABLE ${tableName} DROP COLUMN ${column.name};`;
        await this.query(query);
    }

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
}
