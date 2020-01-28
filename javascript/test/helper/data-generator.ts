import {
  name as FakerName,
  randomBoolean,
  number,
  string,
  arrayElement
} from 'faker';
import * as Faker from 'faker';
import * as clone from 'clone';
import {
  Human
} from './types';
import { WriteOperation } from '../../src/types';

/**
 * use a seed to ensure each time we generate the same data
 */
Faker.seed(123);

export function randomHuman(): Human {
  return {
    _id: string(),
    name: FakerName.firstName().toLowerCase(),
    gender: randomBoolean() ? 'f' : 'm',
    age: number({ min: 1, max: 100 }),
    alive: randomBoolean()
  };
}

export function randomHumans(amount = 0): Human[] {
  return new Array(amount).fill(0).map(() => randomHuman());
}


const keyToChangeFn = {
  1: i => i.name = FakerName.firstName().toLowerCase(),
  2: i => i.gender = randomBoolean() ? 'f' : 'm',
  3: i => i.age = number({ min: 1, max: 100 }),
  4: i => i.alive = randomBoolean()
};

export function randomChangeHuman(input: Human): Human {
  const cloned: Human = clone(input);

  const field = number({ min: 1, max: 4 });
  keyToChangeFn[field](cloned);

  return cloned;
}

export function randomOperation(): WriteOperation {
  return arrayElement([
    'INSERT',
    'UPDATE',
    'DELETE'
  ]);
}

export function randomWrite(allDocs: Human[]) {
  const op = randomOperation();

  const ret = {
    _id: undefined,
    op,
    doc: undefined,
    previous: undefined
  };

  switch (op) {
    case 'INSERT':
      const newDoc = randomHuman();
      ret._id = newDoc._id;
      ret.doc = newDoc;
      ret.previous = null;
      break;
    case 'UPDATE':
      const oldDoc = arrayElement(allDocs);
      const changedDoc = randomChangeHuman(oldDoc);
      ret._id = oldDoc._id;
      ret.doc = changedDoc;
      ret.previous = oldDoc;
      break;
    case 'DELETE':
      const docToDelete: Human = arrayElement(allDocs);
      ret._id = docToDelete._id;
      ret.doc = null;
      ret.previous = docToDelete;
      break;
  }

  return ret;
}