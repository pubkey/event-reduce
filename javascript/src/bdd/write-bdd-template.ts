import * as fs from 'fs';
import * as path from 'path';

export const BDD_TEMPLATE_LOCATION = path.join(
    __dirname,
    './bdd.template.ts'
);
export const BDD_TEMPLATE_GOAL = path.join(
    __dirname,
    './bdd.generated.ts'
);

export function writeBddTemplate(
    minimalBddString: string
) {
    let templateString: string = fs.readFileSync(BDD_TEMPLATE_LOCATION, 'utf-8');
    const replaceVariables = {
        minimalBddString: '\'' + minimalBddString + '\'',
    };

    Object.entries(replaceVariables).forEach(([key, content]) => {
        const contentString = content as string;
        const templateVar = '\'${' + key + '}\'';
        templateString = templateString.replace(templateVar, contentString);
    });

    fs.writeFileSync(
        BDD_TEMPLATE_GOAL,
        templateString,
        { encoding: 'utf8', flag: 'w' }
    );
}
