import Faker from 'faker';
import {
  Human, Procedure
} from './types';
import {
  ChangeEvent
} from '../../src/types';
import {
  getMinimongoCollection,
  minimongoFind,
  applyChangeEvent
} from './minimongo-helper';
import { UNKNOWN_VALUE } from './config';
import { randomOfArray } from '../util';

/**
 * use a seed to ensure each time we generate the same data
 */
Faker.seed(2345);

export function randomHuman(): Human {
  return {
    _id: Faker.random.alphaNumeric(10),
    name: Faker.name.firstName().toLowerCase(),
    gender: Faker.random.boolean() ? 'f' : 'm',
    age: Faker.random.number({ min: 1, max: 100 })
  };
}

export const STATIC_RANDOM_HUMAN: Human = randomHuman();
STATIC_RANDOM_HUMAN._id = 'static_random_human';

export function randomHumans(amount = 0): Human[] {
  return new Array(amount).fill(0).map(() => randomHuman());
}


const keyToChangeFn = {
  1: (i: Human) => i.name = Faker.name.firstName().toLowerCase(),
  2: (i: Human) => i.gender = Faker.random.boolean() ? 'f' : 'm',
  3: (i: Human) => i.age = Faker.random.number({ min: 1, max: 100 })
};

export function randomChangeHuman(input: Human): Human {
  const cloned: Human = Object.assign({}, input);

  const field = Faker.random.number({ min: 1, max: 3 });
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
  if (ret.previous && Faker.random.boolean()) {
    ret.previous = UNKNOWN_VALUE;
  }

  return ret;
}

export async function getRandomChangeEvents(
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
      selector: {}
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
      selector: {}
    });
  }

  return ret;
}
