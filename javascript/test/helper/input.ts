import {
    StateResolveFunctionInput,
    QueryParams
} from '../../src/types/index.js';
import { Human } from '../../src/truth-table-generator/types.js';
import { getQueryParamsByMongoQuery } from '../../src/truth-table-generator/minimongo-helper.js';
import { randomChangeEvent } from '../../src/truth-table-generator/data-generator.js';

export function getExampleStateResolveFunctionInput(): StateResolveFunctionInput<Human> {
    const queryParams: QueryParams<Human> = getQueryParamsByMongoQuery({
        selector: {},
        sort: ['_id']
    });
    return {
        previousResults: [],
        changeEvent: randomChangeEvent([], 'INSERT'),
        queryParams
    };

}
