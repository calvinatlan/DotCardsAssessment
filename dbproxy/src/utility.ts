import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {fileURLToPath} from 'url';

// Get current directory name
export function getDirName() {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
}

// Pull environment variables from .env file
export function setupEnvVar() {
    const __dirname = getDirName();
    dotenv.config({path: path.join(__dirname, '..', '..', '.env')});
}

// Sleep method
export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch schema object from json file
export function getSchema() {
    const __dirname = getDirName();
    const schemaFilePath = path.join(__dirname, '..', '..', 'schema.json');
    const rawData = fs.readFileSync(schemaFilePath);
    return JSON.parse(rawData.toString());
}

// Switch type from schema convention to MySQL convention
export function convertTypeMySQL(colType: string) {
    switch(colType) {
        case 'integer': return 'INT';
        case 'string': return 'VARCHAR(255)';
        default: return 'VARCHAR(255)';
    }
}

// Switch type from MySQL convention to schema convention
export function convertTypeSchema(column: {Field: string, Type: string}) {
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

// Filter out schema by table name then by column name to find the type
export function getFieldTypeSchema(schema: {tables: {name: string, columns: {name: string, type: string}[]}[]}, tableName: string, fieldName: string) {
    return schema.tables.filter(table => table.name === tableName)[0].columns.filter(col => col.name === fieldName)[0].type;
}

// Wrap string in quotes
export function wrapString(input: string) {
    return '"' + input + '"';
}
