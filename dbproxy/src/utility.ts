export function getColumnTypeQuery(colType: string) {
    switch(colType) {
        case 'integer': return 'INT';
        case 'string': return 'VARCHAR(255)';
        default: return 'VARCHAR(255)';
    }
}
export function sqlColumnToSchema(column: {Field: string, Type: string}) {
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

export function getFieldTypeSchema(schema: {tables: {name: string, columns: {name: string, type: string}[]}[]}, tableName: string, fieldName: string) {
    return schema.tables.filter(table => table.name === tableName)[0].columns.filter(col => col.name === fieldName)[0].type;
}
