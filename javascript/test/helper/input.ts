import {
    StateResolveFunctionInput,
    QueryParams
} from '../../src/types';
import {
    Human
} from '../../src/logic-generator/types';
import {
    randomChangeEvent
} from '../../src/logic-generator/data-generator';
import { getQueryParamsByMongoQuery } from '../../src/logic-generator/minimongo-helper';
import { DEFAULT_EXAMPLE_QUERY } from '../../src/logic-generator/queries';

export function getExampleStateResolveFunctionInput(): StateResolveFunctionInput<Human> {
    const queryParams: QueryParams<Human> = getQueryParamsByMongoQuery(DEFAULT_EXAMPLE_QUERY);
    return {
        previousResults: [],
        changeEvent: randomChangeEvent([]),
        queryParams
    };

}