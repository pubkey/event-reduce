import Faker from 'faker';
import {
  Human
} from './types';
import {
  WriteOperation,
  ChangeEvent,
  UNKNOWN_VALUE
} from '../../src/types';

/**
 * use a seed to ensure each time we generate the same data
 */
Faker.seed(2345);

export function randomHuman(): Human {
  return {
    _id: Faker.random.alphaNumeric(),
    name: Faker.name.firstName().toLowerCase(),
    gender: Faker.random.boolean() ? 'f' : 'm',
    age: Faker.random.number({ min: 1, max: 100 }),
    alive: Faker.random.boolean()
  };
}

export function randomHumans(amount = 0): Human[] {
  return new Array(amount).fill(0).map(() => randomHuman());
}


const keyToChangeFn = {
  1: (i: Human) => i.name = Faker.name.firstName().toLowerCase(),
  2: (i: Human) => i.gender = Faker.random.boolean() ? 'f' : 'm',
  3: (i: Human) => i.age = Faker.random.number({ min: 1, max: 100 }),
  4: (i: Human) => i.alive = Faker.random.boolean()
};

export function randomChangeHuman(input: Human): Human {
  const cloned: Human = Object.assign({}, input);

  const field = Faker.random.number({ min: 1, max: 4 });
  keyToChangeFn[field](cloned);

  return cloned;
}

export function randomOperation(): WriteOperation {
  return Faker.random.arrayElement([
    'INSERT',
    'INSERT', // we get insert more often so that the database fill up after time
    'UPDATE',
    'DELETE'
  ]);
}

export function randomChangeEvent(allDocs: Human[]): ChangeEvent<Human> {
  const operation = allDocs.length === 0 ? 'INSERT' : randomOperation();

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
