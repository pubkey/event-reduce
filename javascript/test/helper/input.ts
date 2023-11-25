import {
    StateResolveFunctionInput,
    QueryParams
} from '../../src/types/index.js';
import { Human } from '../../src/truth-table-generator/types.js';
import { randomChangeEvent } from '../../src/truth-table-generator/data-generator.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';


const pseudoCollection = mingoCollectionCreator();

export function getExampleStateResolveFunctionInput(): StateResolveFunctionInput<Human> {
    const queryParams: QueryParams<Human> = pseudoCollection.getQueryParams({
        selector: {},
        sort: ['_id']
    });
    return {
        previousResults: [],
        changeEvent: randomChangeEvent([], 'INSERT'),
        queryParams
    };

}
