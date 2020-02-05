import Faker from 'faker';
import { ChangeEvent } from '../types';
import { Human } from './types';
import { randomHumans, randomChangeHuman } from './data-generator';
import { UNKNOWN_VALUE } from './config';
import { compileSort } from './minimongo-helper';
import { clone } from 'async-test-util';


export function insertChangeAndCleanup(
    unknownPrevious: boolean = false
): ChangeEvent<Human>[] {
    const ret: ChangeEvent<Human>[] = [];

    let docs: Human[] = [];
    randomHumans(20).forEach(h => {
        const insertEvent: ChangeEvent<Human> = {
            operation: 'INSERT',
            doc: h,
            previous: null,
            id: h._id
        };
        docs.push(h);
        ret.push(insertEvent);

        // do a random update
        const updateDoc = Faker.random.arrayElement(docs);
        const after = randomChangeHuman(updateDoc);

        docs = docs.filter(d => d._id !== updateDoc._id);
        docs.push(after);

        const updateEvent: ChangeEvent<Human> = {
            operation: 'UPDATE',
            doc: after,
            previous: updateDoc,
            id: after._id
        };
        ret.push(updateEvent);
    });

    // update all to big age
    const shuffled = Faker.helpers.shuffle(docs);
    while (shuffled.length > 0) {
        const changeMe = shuffled.pop() as Human;
        const changeMeAfter = randomChangeHuman(changeMe);

        docs = docs.filter(d => d._id !== changeMe._id);
        docs.push(changeMeAfter);

        changeMeAfter.age = 1000 + Faker.random.number({
            min: 10,
            max: 100
        });
        const updateEvent: ChangeEvent<Human> = {
            operation: 'UPDATE',
            doc: changeMeAfter,
            previous: changeMe,
            id: changeMeAfter._id
        };
        ret.push(updateEvent);
    }

    // cleanup
    const shuffled2 = Faker.helpers.shuffle(docs);
    while (shuffled2.length > 0) {
        const deleteMe = shuffled2.pop() as Human;
        const deleteEvent: ChangeEvent<Human> = {
            operation: 'DELETE',
            doc: null,
            previous: deleteMe,
            id: deleteMe._id
        };
        ret.push(deleteEvent);
    }

    if (unknownPrevious) {
        ret
            .filter(ev => ev.previous)
            .forEach(ev => ev.previous = UNKNOWN_VALUE);
    }

    return ret;
}

export function insertFiveThenChangeAgeOfOne(): ChangeEvent<Human>[] {
    const humans = randomHumans(5).sort(compileSort(['age']));
    const ret: ChangeEvent<Human>[] = humans.map(human => {
        const changeEvent: ChangeEvent<Human> = {
            operation: 'INSERT',
            id: human._id,
            doc: human,
            previous: null
        };
        return changeEvent;
    });
    const prevDoc = humans[3];
    const changedDoc = clone(prevDoc);
    changedDoc.age = 0;

    const updateEvent: ChangeEvent<Human> = {
        operation: 'UPDATE',
        id: prevDoc._id,
        doc: changedDoc,
        previous: prevDoc
    };
    ret.push(updateEvent);


    const deleteDoc = clone(changedDoc);
    const deleteEvent: ChangeEvent<Human> = {
        operation: 'DELETE',
        id: deleteDoc._id,
        doc: null,
        previous: deleteDoc
    };
    ret.push(deleteEvent);
    return ret;
}

// edge-cases we found by fuzzing
export const PROCEDURES_FROM_FUZZING: ChangeEvent<Human>[][] = [
    [
        {
            operation: 'INSERT',
            id: 'cbc2669idd',
            doc: {
                _id: 'cbc2669idd',
                name: 'makenzie',
                gender: 'f',
                age: 64
            },
            previous: null
        },
        {
            operation: 'UPDATE',
            id: 'cbc2669idd',
            doc: {
                _id: 'cbc2669idd',
                name: 'lavon',
                gender: 'f',
                age: 64
            },
            previous: {
                _id: 'cbc2669idd',
                name: 'makenzie',
                gender: 'f',
                age: 64
            }
        },
        {
            operation: 'UPDATE',
            id: 'cbc2669idd',
            doc: {
                _id: 'cbc2669idd',
                name: 'lavon',
                gender: 'm',
                age: 64
            },
            previous: 'UNKNOWN'
        }
    ],
    [
        {
            operation: 'INSERT',
            id: 'z08qjgjn69',
            doc: {
                _id: 'z08qjgjn69',
                name: 'jessy',
                gender: 'f',
                age: 97
            },
            previous: null
        },
        {
            operation: 'UPDATE',
            id: 'z08qjgjn69',
            doc: {
                _id: 'z08qjgjn69',
                name: 'jessy',
                gender: 'm',
                age: 97
            },
            previous: {
                _id: 'z08qjgjn69',
                name: 'jessy',
                gender: 'f',
                age: 97
            }
        }
    ],
    [
        {
            operation: 'INSERT',
            id: 'iq6qc0i283',
            doc: {
                _id: 'iq6qc0i283',
                name: 'yoshiko',
                gender: 'f',
                age: 10
            },
            previous: null
        },
        {
            operation: 'UPDATE',
            id: 'iq6qc0i283',
            doc: {
                _id: 'iq6qc0i283',
                name: 'yoshiko',
                gender: 'f',
                age: 88
            },
            previous: 'UNKNOWN'
        }
    ]
];

let CACHE: Promise<ChangeEvent<Human>[][]>;
export async function getTestProcedures(): Promise<ChangeEvent<Human>[][]> {
    if (!CACHE) {
        const ret: ChangeEvent<Human>[][] = [];
        ret.push(insertChangeAndCleanup());
        ret.push(insertChangeAndCleanup(true));
        ret.push(insertFiveThenChangeAgeOfOne());
        CACHE = Promise.resolve(ret);
    }
    return CACHE;
}
