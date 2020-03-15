import {
    StateResolveFunctionInput,
    QueryParams
} from '../../src/types';
import { Human } from '../../src/truth-table-generator/types';
import { getQueryParamsByMongoQuery } from '../../src/truth-table-generator/minimongo-helper';
import { randomChangeEvent } from '../../src/truth-table-generator/data-generator';

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