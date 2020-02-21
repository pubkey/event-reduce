import * as fs from 'fs';
import * as path from 'path';
import {
    BooleanFunctionReorderMapping,
    BooleanFunctionReorderMappingReverse
} from 'binary-decision-diagram';
import { orderedStateList, stateResolveFunctions } from '../states';
import { orderedActionList } from '../actions';

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

    let stateResolvers = '\n';
    orderedStateList.forEach((stateName, index) => {
        stateResolvers += '    ' + index + ': ' + stateName + ',\n';
    });
    stateResolvers = '{' + stateResolvers + '}';

    const replaceVariables = {
        minimalBddString: '\'' + minimalBddString + '\'',
        stateResolvers
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
