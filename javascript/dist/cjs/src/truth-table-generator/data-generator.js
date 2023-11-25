"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._getRandomChangeEvents = exports.fillRandomEvents = exports.getRandomChangeEvents = exports.randomEventsPrematureCalculation = exports.randomChangeEvent = exports.randomChangeHuman = exports.mutateFieldFunctions = exports.randomHumans = exports.STATIC_RANDOM_HUMAN = exports.randomHuman = exports.HUMAN_MAX_AGE = void 0;
const util_js_1 = require("../util.js");
const mingo_js_1 = require("./database/mingo.js");
const index_js_1 = require("./database/index.js");
const async_test_util_1 = require("async-test-util");
/**
 * Do not use a too height value
 * so that it more often triggers sort changes.
 */
exports.HUMAN_MAX_AGE = 20;
function randomHuman(partial) {
    const ret = {
        _id: (0, async_test_util_1.randomString)(10),
        name: (0, async_test_util_1.randomString)(10),
        gender: (0, async_test_util_1.randomBoolean)() ? 'f' : 'm',
        age: (0, async_test_util_1.randomNumber)(1, exports.HUMAN_MAX_AGE)
    };
    if (partial) {
        Object.entries(partial).forEach(([k, v]) => {
            ret[k] = v;
        });
    }
    return ret;
}
exports.randomHuman = randomHuman;
exports.STATIC_RANDOM_HUMAN = randomHuman();
exports.STATIC_RANDOM_HUMAN._id = 'static_random_human';
function randomHumans(amount = 0, partial) {
    return new Array(amount).fill(0).map(() => randomHuman(partial));
}
exports.randomHumans = randomHumans;
exports.mutateFieldFunctions = {
    name: (i) => i.name = (0, async_test_util_1.randomString)(10),
    gender: (i) => i.gender = (0, async_test_util_1.randomBoolean)() ? 'f' : 'm',
    age: (i) => i.age = (0, async_test_util_1.randomNumber)(1, exports.HUMAN_MAX_AGE)
};
const changeableFields = Object.keys(exports.mutateFieldFunctions);
function randomChangeHuman(input) {
    const cloned = Object.assign({}, input);
    // mutate up to all 3 random fields or no field at all
    const amountOfFieldChanges = (0, async_test_util_1.randomNumber)(0, changeableFields.length);
    new Array(amountOfFieldChanges).fill(0).forEach(() => {
        const field = (0, util_js_1.randomOfArray)(changeableFields);
        exports.mutateFieldFunctions[field](cloned);
    });
    return cloned;
}
exports.randomChangeHuman = randomChangeHuman;
function randomChangeEvent(allDocs, favor) {
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
    const randomOp = (0, util_js_1.randomOfArray)(ops);
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
            const oldDoc = (0, util_js_1.randomOfArray)(allDocs);
            const changedDoc = randomChangeHuman(oldDoc);
            ret = {
                operation,
                id: oldDoc._id,
                doc: changedDoc,
                previous: oldDoc
            };
            break;
        case 'DELETE':
            const docToDelete = (0, util_js_1.randomOfArray)(allDocs);
            ret = {
                operation,
                id: docToDelete._id,
                doc: null,
                previous: docToDelete
            };
            break;
    }
    return ret;
}
exports.randomChangeEvent = randomChangeEvent;
// ensure that the change-events get generated
// before we even need them
exports.randomEventsPrematureCalculation = {};
function getRandomChangeEvents(amount = 100) {
    if (exports.randomEventsPrematureCalculation[amount]) {
        fillRandomEvents(amount);
        const ret = exports.randomEventsPrematureCalculation[amount];
        delete exports.randomEventsPrematureCalculation[amount];
        return ret;
    }
    else {
        fillRandomEvents(amount);
        return _getRandomChangeEvents(amount);
    }
}
exports.getRandomChangeEvents = getRandomChangeEvents;
function fillRandomEvents(amount) {
    const newEvents = _getRandomChangeEvents(amount);
    exports.randomEventsPrematureCalculation[amount] = newEvents;
}
exports.fillRandomEvents = fillRandomEvents;
function _getRandomChangeEvents(amount = 100) {
    const ret = [];
    const half = Math.ceil(amount / 2);
    const collection = (0, mingo_js_1.mingoCollectionCreator)();
    let allDocs = [];
    // in the first half, we do more inserts
    while (ret.length < half) {
        const changeEvent = randomChangeEvent(allDocs, 'INSERT');
        ret.push(changeEvent);
        (0, index_js_1.applyChangeEvent)(collection, changeEvent);
        allDocs = collection.query({
            selector: {},
            sort: ['_id']
        });
    }
    // in the second half, we do more deletes
    while (ret.length < amount) {
        const changeEvent = randomChangeEvent(allDocs, 'DELETE');
        ret.push(changeEvent);
        (0, index_js_1.applyChangeEvent)(collection, changeEvent);
        allDocs = collection.query({
            selector: {},
            sort: ['_id']
        });
    }
    return ret;
}
exports._getRandomChangeEvents = _getRandomChangeEvents;
//# sourceMappingURL=data-generator.js.map