import {
  name as FakerName,
  randomBoolean,
  number,
  string,
  arrayElement
} from 'faker';
import * as Faker from 'faker';
import {
  Human
} from './types';
import {
  WriteOperation,
  ChangeEvent
} from '../../src/types';

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
  const cloned: Human = Object.assign({}, input);

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

export function randomChangeEvent(allDocs: Human[]): ChangeEvent<Human> {
  const operation = randomOperation();

  switch (operation) {
    case 'INSERT':
      const newDoc = randomHuman();
      return {
        operation,
        key: newDoc._id,
        doc: newDoc,
        previous: null
      };
    case 'UPDATE':
      const oldDoc = arrayElement(allDocs);
      const changedDoc = randomChangeHuman(oldDoc);
      return {
        operation,
        key: oldDoc._id,
        doc: changedDoc,
        previous: oldDoc
      };
    case 'DELETE':
      const docToDelete: Human = arrayElement(allDocs);
      return {
        operation,
        key: oldDoc._id,
        doc: null,
        previous: docToDelete
      };
  }
}
