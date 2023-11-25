import { randomHumans, randomChangeHuman, HUMAN_MAX_AGE } from './data-generator.js';
import { ensureNotFalsy, flatClone, randomOfArray, shuffleArray } from '../util.js';
import { randomNumber } from 'async-test-util';
export function insertChangeAndCleanup() {
    const ret = [];
    let docs = [];
    randomHumans(5).forEach(h => {
        const insertEvent = {
            operation: 'INSERT',
            doc: h,
            previous: null,
            id: h._id
        };
        docs.push(h);
        ret.push(insertEvent);
        // do a random update
        const updateDoc = randomOfArray(docs);
        const after = randomChangeHuman(updateDoc);
        docs = docs.filter(d => d._id !== updateDoc._id);
        docs.push(after);
        const updateEvent = {
            operation: 'UPDATE',
            doc: after,
            previous: updateDoc,
            id: after._id
        };
        ret.push(updateEvent);
    });
    // update all to big age
    const shuffled = shuffleArray(docs);
    while (shuffled.length > 0) {
        const changeMe = shuffled.pop();
        const changeMeAfter = randomChangeHuman(changeMe);
        docs = docs.filter(d => d._id !== changeMe._id);
        docs.push(changeMeAfter);
        changeMeAfter.age = 1000 + randomNumber(10, HUMAN_MAX_AGE);
        const updateEvent = {
            operation: 'UPDATE',
            doc: changeMeAfter,
            previous: changeMe,
            id: changeMeAfter._id
        };
        ret.push(updateEvent);
    }
    // cleanup
    const shuffled2 = shuffleArray(docs);
    while (shuffled2.length > 0) {
        const deleteMe = shuffled2.pop();
        const deleteEvent = {
            operation: 'DELETE',
            doc: null,
            previous: deleteMe,
            id: deleteMe._id
        };
        ret.push(deleteEvent);
    }
    return ret;
}
export function insertFiveSorted() {
    return [
        {
            operation: 'INSERT',
            id: '1',
            doc: {
                _id: '1',
                name: 'jessy1',
                gender: 'f',
                age: 1
            },
            previous: null
        },
        {
            operation: 'INSERT',
            id: '2',
            doc: {
                _id: '2',
                name: 'jessy2',
                gender: 'f',
                age: 2
            },
            previous: null
        },
        {
            operation: 'INSERT',
            id: '3',
            doc: {
                _id: '3',
                name: 'jessy3',
                gender: 'f',
                age: 3
            },
            previous: null
        },
        {
            operation: 'INSERT',
            id: '4',
            doc: {
                _id: '4',
                name: 'jessy4',
                gender: 'f',
                age: 4
            },
            previous: null
        }, {
            operation: 'INSERT',
            id: '5',
            doc: {
                _id: '5',
                name: 'jessy5',
                gender: 'f',
                age: 5
            },
            previous: null
        }
    ];
}
export function insertFiveSortedThenRemoveSorted() {
    const inserts = insertFiveSorted();
    const ret = inserts.slice();
    inserts.forEach(cE => {
        const doc = flatClone(ensureNotFalsy(cE.doc));
        ret.push({
            operation: 'DELETE',
            doc: null,
            id: doc._id,
            previous: doc
        });
    });
    return ret;
}
export function oneThatWasCrashing() {
    return [
        {
            operation: 'INSERT',
            doc: { _id: '7u3de00tms', name: 'maye', gender: 'f', age: 78 },
            previous: null,
            id: '7u3de00tms'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '7u3de00tms', name: 'maye', gender: 'f', age: 78 },
            previous: { _id: '7u3de00tms', name: 'maye', gender: 'f', age: 78 },
            id: '7u3de00tms'
        },
        {
            operation: 'INSERT',
            doc: { _id: '3184gyi5e4', name: 'joel', gender: 'f', age: 91 },
            previous: null,
            id: '3184gyi5e4'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '7u3de00tms', name: 'toby', gender: 'f', age: 78 },
            previous: { _id: '7u3de00tms', name: 'maye', gender: 'f', age: 78 },
            id: '7u3de00tms'
        },
        {
            operation: 'INSERT',
            doc: { _id: '4im72wg9ev', name: 'sadie', gender: 'f', age: 72 },
            previous: null,
            id: '4im72wg9ev'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '3184gyi5e4', name: 'john', gender: 'f', age: 91 },
            previous: { _id: '3184gyi5e4', name: 'joel', gender: 'f', age: 91 },
            id: '3184gyi5e4'
        },
        {
            operation: 'INSERT',
            doc: { _id: '0swab77ah3', name: 'salma', gender: 'm', age: 35 },
            previous: null,
            id: '0swab77ah3'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '0swab77ah3', name: 'salma', gender: 'm', age: 48 },
            previous: { _id: '0swab77ah3', name: 'salma', gender: 'm', age: 35 },
            id: '0swab77ah3'
        },
        {
            operation: 'INSERT',
            doc: { _id: '12ypzlmfgd', name: 'josie', gender: 'm', age: 35 },
            previous: null,
            id: '12ypzlmfgd'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '4im72wg9ev', name: 'kitty', gender: 'f', age: 72 },
            previous: { _id: '4im72wg9ev', name: 'sadie', gender: 'f', age: 72 },
            id: '4im72wg9ev'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '4im72wg9ev', name: 'kitty', gender: 'f', age: 1035 },
            previous: { _id: '4im72wg9ev', name: 'kitty', gender: 'f', age: 72 },
            id: '4im72wg9ev'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '0swab77ah3', name: 'sage', gender: 'm', age: 1017 },
            previous: { _id: '0swab77ah3', name: 'salma', gender: 'm', age: 48 },
            id: '0swab77ah3'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '12ypzlmfgd', name: 'josie', gender: 'm', age: 1083 },
            previous: { _id: '12ypzlmfgd', name: 'josie', gender: 'm', age: 35 },
            id: '12ypzlmfgd'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '3184gyi5e4', name: 'rosella', gender: 'f', age: 1080 },
            previous: { _id: '3184gyi5e4', name: 'john', gender: 'f', age: 91 },
            id: '3184gyi5e4'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '7u3de00tms', name: 'toby', gender: 'f', age: 1100 },
            previous: { _id: '7u3de00tms', name: 'toby', gender: 'f', age: 78 },
            id: '7u3de00tms'
        },
        {
            operation: 'DELETE',
            doc: null,
            previous: { _id: '7u3de00tms', name: 'toby', gender: 'f', age: 1100 },
            id: '7u3de00tms'
        },
        {
            operation: 'DELETE',
            doc: null,
            previous: { _id: '3184gyi5e4', name: 'rosella', gender: 'f', age: 1080 },
            id: '3184gyi5e4'
        },
        {
            operation: 'DELETE',
            doc: null,
            previous: { _id: '0swab77ah3', name: 'sage', gender: 'm', age: 1017 },
            id: '0swab77ah3'
        },
        {
            operation: 'DELETE',
            doc: null,
            previous: { _id: '12ypzlmfgd', name: 'josie', gender: 'm', age: 1083 },
            id: '12ypzlmfgd'
        },
        {
            operation: 'DELETE',
            doc: null,
            previous: { _id: '4im72wg9ev', name: 'kitty', gender: 'f', age: 1035 },
            id: '4im72wg9ev'
        }
    ];
}
export function sortParamChanged() {
    return [
        {
            operation: 'INSERT',
            doc: { _id: '6eu7byz49iq9', name: 'Eugenia', gender: 'f', age: 16 },
            previous: null,
            id: '6eu7byz49iq9'
        },
        {
            operation: 'INSERT',
            doc: { _id: 's90j6hhznefj', name: 'Freeman', gender: 'f', age: 25 },
            previous: null,
            id: 's90j6hhznefj'
        },
        {
            operation: 'UPDATE',
            doc: { _id: '6eu7byz49iq9', name: 'Eugenia', gender: 'f', age: 50 },
            previous: { _id: '6eu7byz49iq9', name: 'Eugenia', gender: 'f', age: 16 },
            id: '6eu7byz49iq9'
        }
    ];
}
let CACHE;
export function getTestProcedures() {
    if (!CACHE) {
        const ret = [];
        ret.push(insertChangeAndCleanup());
        ret.push(insertChangeAndCleanup());
        ret.push(insertFiveSortedThenRemoveSorted());
        ret.push(oneThatWasCrashing());
        ret.push(sortParamChanged());
        CACHE = ret;
    }
    return CACHE;
}
//# sourceMappingURL=procedures.js.map