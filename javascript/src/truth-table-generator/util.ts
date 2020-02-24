import * as fs from 'fs';

export function readJsonFile(path: string): any {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

export function writeJsonFile(
    path: string,
    data: any
) {
    fs.writeFileSync(
        path,
        JSON.stringify(data, null, 2),
        { encoding: 'utf8', flag: 'w' }
    );
}
