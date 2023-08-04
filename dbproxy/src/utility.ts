export function getColumnTypeQuery(colType: string) {
    switch(colType) {
        case 'integer': return 'INT';
        case 'string': return 'VARCHAR(255)';
        default: return 'VARCHAR(255)';
    }
}
