"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._getRandomChangeEvents = exports.fillRandomEvents = exports.getRandomChangeEvents = exports.randomEventsPrematureCalculation = exports.randomChangeEvent = exports.randomChangeHuman = exports.randomHumans = exports.STATIC_RANDOM_HUMAN = exports.randomHuman = void 0;
const faker_1 = require("@faker-js/faker");
const minimongo_helper_js_1 = require("./minimongo-helper.js");
const config_js_1 = require("./config.js");
const util_js_1 = require("../util.js");
/**
 * Set a seed to ensure we create deterministic and testable
 * test data.
 */
faker_1.faker.seed(2345);
function randomHuman(partial) {
    const ret = {
        _id: (faker_1.faker.number.int(1000) + '').padStart(5, '0'),
        name: faker_1.faker.person.firstName().toLowerCase(),
        gender: faker_1.faker.datatype.boolean() ? 'f' : 'm',
        age: faker_1.faker.number.int({ min: 1, max: 100 })
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
const keyToChangeFn = {
    1: (i) => i.name = faker_1.faker.person.firstName().toLowerCase(),
    2: (i) => i.gender = faker_1.faker.datatype.boolean() ? 'f' : 'm',
    3: (i) => i.age = faker_1.faker.number.int({ min: 1, max: 100 })
};
function randomChangeHuman(input) {
    const cloned = Object.assign({}, input);
    const field = faker_1.faker.number.int({ min: 1, max: 3 });
    keyToChangeFn[field](cloned);
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
            const oldDoc = faker_1.faker.helpers.arrayElement(allDocs);
            const changedDoc = randomChangeHuman(oldDoc);
            ret = {
                operation,
                id: oldDoc._id,
                doc: changedDoc,
                previous: oldDoc
            };
            break;
        case 'DELETE':
            const docToDelete = faker_1.faker.helpers.arrayElement(allDocs);
            ret = {
                operation,
                id: docToDelete._id,
                doc: null,
                previous: docToDelete
            };
            break;
    }
    // randomly set previous to UNKNOWN
    if (ret.previous && faker_1.faker.datatype.boolean()) {
        ret.previous = config_js_1.UNKNOWN_VALUE;
    }
    return ret;
}
exports.randomChangeEvent = randomChangeEvent;
// ensure that the change-events get generated
// before we even need them
exports.randomEventsPrematureCalculation = {};
async function getRandomChangeEvents(amount = 100) {
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
    setTimeout(async () => {
        const newEvents = await _getRandomChangeEvents(amount);
        exports.randomEventsPrematureCalculation[amount] = newEvents;
    }, 20);
}
exports.fillRandomEvents = fillRandomEvents;
async function _getRandomChangeEvents(amount = 100) {
    const ret = [];
    const half = Math.ceil(amount / 2);
    const collection = (0, minimongo_helper_js_1.getMinimongoCollection)();
    let allDocs = [];
    // in the first half, we do more inserts
    while (ret.length < half) {
        const changeEvent = randomChangeEvent(allDocs, 'INSERT');
        ret.push(changeEvent);
        await (0, minimongo_helper_js_1.applyChangeEvent)(collection, changeEvent);
        allDocs = await (0, minimongo_helper_js_1.minimongoFind)(collection, {
            selector: {},
            sort: ['_id']
        });
    }
    // in the second half, we do more deletes
    while (ret.length < amount) {
        const changeEvent = randomChangeEvent(allDocs, 'DELETE');
        ret.push(changeEvent);
        await (0, minimongo_helper_js_1.applyChangeEvent)(collection, changeEvent);
        allDocs = await (0, minimongo_helper_js_1.minimongoFind)(collection, {
            selector: {},
            sort: ['_id']
        });
    }
    return ret;
}
exports._getRandomChangeEvents = _getRandomChangeEvents;
//# sourceMappingURL=data-generator.js.map