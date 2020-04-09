import {
  random,
  name,
  seed
} from 'faker';
import {
  Human,
  Procedure
} from './types';
import {
  ChangeEvent
} from 'event-reduce-js';
import {
  getMinimongoCollection,
  minimongoFind,
  applyChangeEvent
} from './minimongo';
import { randomOfArray } from './util';

/**
 * use a seed to ensure each time we generate the same data
 */
seed(2345);

export function randomHuman(): Human {
  return {
    _id: random.alphaNumeric(10),
    name: name.firstName().toLowerCase(),
    gender: random.boolean() ? 'f' : 'm',
    age: random.number({ min: 1, max: 100 })
  };
}

export const STATIC_RANDOM_HUMAN: Human = randomHuman();
STATIC_RANDOM_HUMAN._id = 'static_random_human';

export function randomHumans(amount = 100): Human[] {
  return new Array(amount).fill(0).map(() => randomHuman());
}

export function getInitialData(amount: number = 100): ChangeEvent<Human>[] {
  return randomHumans(amount).map(doc => {
    const ev: ChangeEvent<Human> = {
      operation: 'INSERT',
      id: doc._id,
      doc,
      previous: null
    };
    return ev;
  });
}

const keyToChangeFn = {
  1: (i: Human) => i.name = name.firstName().toLowerCase(),
  2: (i: Human) => i.gender = random.boolean() ? 'f' : 'm',
  3: (i: Human) => i.age = random.number({ min: 1, max: 100 })
};

export function randomChangeHuman(input: Human): Human {
  const cloned: Human = Object.assign({}, input);

  const field = random.number({ min: 1, max: 3 });
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
      const oldDoc = random.arrayElement(allDocs);
      const changedDoc = randomChangeHuman(oldDoc);
      ret = {
        operation,
        id: oldDoc._id,
        doc: changedDoc,
        previous: oldDoc
      };
      break;
    case 'DELETE':
      const docToDelete: Human = random.arrayElement(allDocs);
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

export async function getRandomChangeEvents(
  previousData: Human[],
  amount: number = 100
): Promise<Procedure<Human>> {
  const ret: ChangeEvent<Human>[] = [];
  const half = Math.ceil(amount / 2);

  const collection = await getMinimongoCollection('memory');
  await Promise.all(previousData.map(doc => applyChangeEvent(
    collection,
    {
      operation: 'INSERT',
      id: doc._id,
      doc,
      previous: null
    }
  )));

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
