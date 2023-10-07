import Faker from 'faker';

import {
  datatype as fakerDatatype
} from 'faker';

import type {
  Human,
  Procedure
} from './types.js';
import type {
  ChangeEvent
} from '../../src/types/index.js';
import {
  getMinimongoCollection,
  minimongoFind,
  applyChangeEvent
} from './minimongo-helper.js';
import { UNKNOWN_VALUE } from './config.js';
import { randomOfArray } from '../util.js';

/**
 * Set a seed to ensure we create deterministic and testable
 * test data.
 */
Faker.seed(2345);

export function randomHuman(partial?: Partial<Human>): Human {
  const ret: Human = {
    _id: Faker.random.alphaNumeric(10),
    name: Faker.name.firstName().toLowerCase(),
    gender: fakerDatatype.boolean() ? 'f' : 'm',
    age: fakerDatatype.number({ min: 1, max: 100 })
  };
  if (partial) {
    Object.entries(partial).forEach(([k, v]) => {
      ret[k] = v;
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
  1: (i: Human) => i.name = Faker.name.firstName().toLowerCase(),
  2: (i: Human) => i.gender = fakerDatatype.boolean() ? 'f' : 'm',
  3: (i: Human) => i.age = fakerDatatype.number({ min: 1, max: 100 })
};

export function randomChangeHuman(input: Human): Human {
  const cloned: Human = Object.assign({}, input);

  const field = fakerDatatype.number({ min: 1, max: 3 });
  keyToChangeFn[field](cloned);

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
      const oldDoc = Faker.random.arrayElement(allDocs);
      const changedDoc = randomChangeHuman(oldDoc);
      ret = {
        operation,
        id: oldDoc._id,
        doc: changedDoc,
        previous: oldDoc
      };
      break;
    case 'DELETE':
      const docToDelete: Human = Faker.random.arrayElement(allDocs);
      ret = {
        operation,
        id: docToDelete._id,
        doc: null,
        previous: docToDelete
      };
      break;
  }

  // randomly set previous to UNKNOWN
  if (ret.previous && fakerDatatype.boolean()) {
    ret.previous = UNKNOWN_VALUE;
  }

  return ret;
}

// ensure that the change-events get generated
// before we even need them
export const randomEventsPrematureCalculation: {
  [amount: number]: Procedure;
} = {};

export async function getRandomChangeEvents(
  amount: number = 100
): Promise<Procedure> {
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
  setTimeout(async () => {
    const newEvents = await _getRandomChangeEvents(amount);
    randomEventsPrematureCalculation[amount] = newEvents;
  }, 20);
}

export async function _getRandomChangeEvents(
  amount: number = 100
): Promise<Procedure> {
  const ret: ChangeEvent<Human>[] = [];
  const half = Math.ceil(amount / 2);
  const collection = getMinimongoCollection();
  let allDocs: Human[] = [];

  // in the first half, we do more inserts
  while (ret.length < half) {
    const changeEvent = randomChangeEvent(allDocs, 'INSERT');
    ret.push(changeEvent);
    await applyChangeEvent(
      collection,
      changeEvent
    );
    allDocs = await minimongoFind(collection, {
      selector: {},
      sort: ['_id']
    });
  }

  // in the second half, we do more deletes
  while (ret.length < amount) {
    const changeEvent = randomChangeEvent(allDocs, 'DELETE');
    ret.push(changeEvent);
    await applyChangeEvent(
      collection,
      changeEvent
    );
    allDocs = await minimongoFind(collection, {
      selector: {},
      sort: ['_id']
    });
  }

  return ret;
}
