import * as fs from 'fs';

export function readJsonFile(path: string): any {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

export function writeJsonFile(
    path: string,
    data: any
) {
    /**
     * Write to a temporary file and rename it,
     * so that parallel fuzzing processes never read a half written file.
     */
    const tmpPath = path + '.' + process.pid + '.tmp';
    fs.writeFileSync(
        tmpPath,
        JSON.stringify(data, null, 2),
        { encoding: 'utf8', flag: 'w' }
    );
    fs.renameSync(tmpPath, path);
}
