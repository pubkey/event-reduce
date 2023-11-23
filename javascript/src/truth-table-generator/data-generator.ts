import type {
  Human,
  Procedure
} from './types.js';
import type {
  ChangeEvent
} from '../../src/types/index.js';
import { UNKNOWN_VALUE } from './config.js';
import { randomOfArray } from '../util.js';
import { mingoCollectionCreator } from './database/mingo.js';
import { applyChangeEvent } from './database/index.js';
import { randomBoolean, randomNumber, randomString } from 'async-test-util';

export function randomHuman(partial?: Partial<Human>): Human {
  const ret: Human = {
    _id: randomString(10),
    name: randomString(10),
    gender: randomBoolean() ? 'f' : 'm',
    age: randomNumber(1, 100)
  };
  if (partial) {
    Object.entries(partial).forEach(([k, v]) => {
      (ret as any)[k] = v;
    });
  }

  return ret;
}

export const STATIC_RANDOM_HUMAN: Human = randomHuman();
STATIC_RANDOM_HUMAN._id = 'static_random_human';

export function randomHumans(amount = 0, partial?: Partial<Human>): Human[] {
  return new Array(amount).fill(0).map(() => randomHuman(partial));
}


const keyToChangeFn = {
  1: (i: Human) => i.name = randomString(10),
  2: (i: Human) => i.gender = randomBoolean() ? 'f' : 'm',
  3: (i: Human) => i.age = randomNumber(1, 100)
};

export function randomChangeHuman(input: Human): Human {
  const cloned: Human = Object.assign({}, input);

  const field = randomNumber(1,3);
  (keyToChangeFn as any)[field](cloned);

  return cloned;
}

export function randomChangeEvent(
  allDocs: Human[],
  favor: 'INSERT' | 'DELETE'
): ChangeEvent<Human> {

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
  let ret: any;
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
      const oldDoc = randomOfArray(allDocs);
      const changedDoc = randomChangeHuman(oldDoc);
      ret = {
        operation,
        id: oldDoc._id,
        doc: changedDoc,
        previous: oldDoc
      };
      break;
    case 'DELETE':
      const docToDelete: Human = randomOfArray(allDocs);
      ret = {
        operation,
        id: docToDelete._id,
        doc: null,
        previous: docToDelete
      };
      break;
  }

  // randomly set previous to UNKNOWN
  if (ret.previous && randomBoolean()) {
    ret.previous = UNKNOWN_VALUE;
  }

  return ret;
}

// ensure that the change-events get generated
// before we even need them
export const randomEventsPrematureCalculation: {
  [amount: number]: Procedure;
} = {};

export function getRandomChangeEvents(
  amount: number = 100
): Procedure {
  if (randomEventsPrematureCalculation[amount]) {
    fillRandomEvents(amount);
    const ret = randomEventsPrematureCalculation[amount];
    delete randomEventsPrematureCalculation[amount];
    return ret;
  } else {
    fillRandomEvents(amount);
    return _getRandomChangeEvents(amount);
  }
}

export function fillRandomEvents(amount: number) {
  const newEvents = _getRandomChangeEvents(amount);
  randomEventsPrematureCalculation[amount] = newEvents;
}

export function _getRandomChangeEvents(
  amount: number = 100
): Procedure {
  const ret: ChangeEvent<Human>[] = [];
  const half = Math.ceil(amount / 2);
  const collection = mingoCollectionCreator();
  let allDocs: Human[] = [];

  // in the first half, we do more inserts
  while (ret.length < half) {
    const changeEvent = randomChangeEvent(allDocs, 'INSERT');
    ret.push(changeEvent);
    applyChangeEvent(
      collection,
      changeEvent
    );
    allDocs = collection.query({
      selector: {},
      sort: ['_id']
    });
  }

  // in the second half, we do more deletes
  while (ret.length < amount) {
    const changeEvent = randomChangeEvent(allDocs, 'DELETE');
    ret.push(changeEvent);
    applyChangeEvent(
      collection,
      changeEvent
    );
    allDocs = collection.query({
      selector: {},
      sort: ['_id']
    });
  }

  return ret;
}
