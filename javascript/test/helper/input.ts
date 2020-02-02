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
export function getExampleStateResolveFunctionInput(): StateResolveFunctionInput<Human> {
    const queryParams: QueryParams<Human> = getQueryParamsByMongoQuery({
        selector: {},
        limit: 100,
        sort: ['_id']
    });
    return {
        previousResults: [],
        changeEvent: randomChangeEvent([]),
        queryParams
    };

}