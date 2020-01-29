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
export function getExampleStateResolveFunctionInput(): StateResolveFunctionInput<Human> {
    const queryParams: QueryParams<Human> = {
        limit: 100,
        primaryKey: '_id',
        queryMatcher: () => true,
        sortComparator: () => -1,
        sortFields: ['_id']
    };
    return {
        previousResults: [],
        changeEvent: randomChangeEvent([]),
        queryParams
    };

}