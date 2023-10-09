import { faker } from '@faker-js/faker';
import { getMinimongoCollection, minimongoFind, applyChangeEvent } from './minimongo-helper.js';
import { UNKNOWN_VALUE } from './config.js';
import { randomOfArray } from '../util.js';
/**
 * Set a seed to ensure we create deterministic and testable
 * test data.
 */
faker.seed(2345);
export function randomHuman(partial) {
    const ret = {
        _id: (faker.number.int(1000) + '').padStart(5, '0'),
        name: faker.person.firstName().toLowerCase(),
        gender: faker.datatype.boolean() ? 'f' : 'm',
        age: faker.number.int({ min: 1, max: 100 })
    };
    if (partial) {
        Object.entries(partial).forEach(([k, v]) => {
            ret[k] = v;
        });
    }
    return ret;
}
export const STATIC_RANDOM_HUMAN = randomHuman();
STATIC_RANDOM_HUMAN._id = 'static_random_human';
export function randomHumans(amount = 0, partial) {
    return new Array(amount).fill(0).map(() => randomHuman(partial));
}
const keyToChangeFn = {
    1: (i) => i.name = faker.person.firstName().toLowerCase(),
    2: (i) => i.gender = faker.datatype.boolean() ? 'f' : 'm',
    3: (i) => i.age = faker.number.int({ min: 1, max: 100 })
};
export function randomChangeHuman(input) {
    const cloned = Object.assign({}, input);
    const field = faker.number.int({ min: 1, max: 3 });
    keyToChangeFn[field](cloned);
    return cloned;
}
export function randomChangeEvent(allDocs, favor) {
    const ops = [
        'INSERT',
        // do many update events
        'UPDATE',
        'UPDATE',
        'UPDATE',
        'UPDATE',
        'UPDATE',
        'DELETE',
        favor
    ];
    const randomOp = randomOfArray(ops);
    const operation = allDocs.length === 0 ? 'INSERT' : randomOp;
    let ret;
    switch (operation) {
        case 'INSERT':
            const newDoc = randomHuman();
            ret = {
                operation,
                id: newDoc._id,
                doc: newDoc,
                previous: null
            };
            break;
        case 'UPDATE':
            const oldDoc = faker.helpers.arrayElement(allDocs);
            const changedDoc = randomChangeHuman(oldDoc);
            ret = {
                operation,
                id: oldDoc._id,
                doc: changedDoc,
                previous: oldDoc
            };
            break;
        case 'DELETE':
            const docToDelete = faker.helpers.arrayElement(allDocs);
            ret = {
                operation,
                id: docToDelete._id,
                doc: null,
                previous: docToDelete
            };
            break;
    }
    // randomly set previous to UNKNOWN
    if (ret.previous && faker.datatype.boolean()) {
        ret.previous = UNKNOWN_VALUE;
    }
    return ret;
}
// ensure that the change-events get generated
// before we even need them
export const randomEventsPrematureCalculation = {};
export async function getRandomChangeEvents(amount = 100) {
    if (randomEventsPrematureCalculation[amount]) {
        fillRandomEvents(amount);
        const ret = randomEventsPrematureCalculation[amount];
        delete randomEventsPrematureCalculation[amount];
        return ret;
    }
    else {
        fillRandomEvents(amount);
        return _getRandomChangeEvents(amount);
    }
}
export function fillRandomEvents(amount) {
    setTimeout(async () => {
        const newEvents = await _getRandomChangeEvents(amount);
        randomEventsPrematureCalculation[amount] = newEvents;
    }, 20);
}
export async function _getRandomChangeEvents(amount = 100) {
    const ret = [];
    const half = Math.ceil(amount / 2);
    const collection = getMinimongoCollection();
    let allDocs = [];
    // in the first half, we do more inserts
    while (ret.length < half) {
        const changeEvent = randomChangeEvent(allDocs, 'INSERT');
        ret.push(changeEvent);
        await applyChangeEvent(collection, changeEvent);
        allDocs = await minimongoFind(collection, {
            selector: {},
            sort: ['_id']
        });
    }
    // in the second half, we do more deletes
    while (ret.length < amount) {
        const changeEvent = randomChangeEvent(allDocs, 'DELETE');
        ret.push(changeEvent);
        await applyChangeEvent(collection, changeEvent);
        allDocs = await minimongoFind(collection, {
            selector: {},
            sort: ['_id']
        });
    }
    return ret;
}
//# sourceMappingURL=data-generator.js.map