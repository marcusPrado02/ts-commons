import type { StoryModule } from '../story/StoryTypes';

// ---------------------------------------------------------------------------
// Email Value Object
// ---------------------------------------------------------------------------

interface EmailVO {
  readonly raw: string;
  isValid(): boolean;
  getDomain(): string;
  getLocalPart(): string;
  equals(other: EmailVO): boolean;
}

function makeEmail(raw: string): EmailVO {
  const parts = raw.split('@');
  const local = parts[0] ?? '';
  const domain = parts[1] ?? '';
  return {
    raw,
    isValid(): boolean {
      return raw.includes('@') && domain.includes('.') && local.length > 0;
    },
    getDomain(): string {
      return domain;
    },
    getLocalPart(): string {
      return local;
    },
    equals(other: EmailVO): boolean {
      return raw === other.raw;
    },
  };
}

export const EmailModule: StoryModule<EmailVO> = {
  meta: {
    title: 'Email Value Object',
    description: 'Demonstrates the Email VO — validation, domain extraction, equality.',
    component: 'EmailValueObject',
    tags: ['value-object', 'ddd', 'validation'],
    create: () => makeEmail('alice@example.com'),
  },
  stories: [
    {
      name: 'valid email passes isValid',
      description: 'A well-formed email address should pass validation.',
      args: {},
      execute: (subject) => subject.isValid(),
      expectedOutcome: 'true',
    },
    {
      name: 'invalid email fails isValid',
      description: 'An email missing the @ character is invalid.',
      args: {},
      execute: () => makeEmail('not-an-email').isValid(),
      expectedOutcome: 'false',
    },
    {
      name: 'getDomain returns domain part',
      description: 'Domain extracted after the @ symbol.',
      args: {},
      execute: (subject) => subject.getDomain(),
      expectedOutcome: 'example.com',
    },
    {
      name: 'getLocalPart returns local part',
      description: 'Local part extracted before the @ symbol.',
      args: {},
      execute: (subject) => subject.getLocalPart(),
      expectedOutcome: 'alice',
    },
    {
      name: 'equal emails satisfy equals()',
      description: 'Two VOs with the same raw value are structurally equal.',
      args: {},
      execute: (subject) => subject.equals(makeEmail('alice@example.com')),
      expectedOutcome: 'true',
    },
    {
      name: 'different emails fail equals()',
      description: 'Two VOs with different raw values are not equal.',
      args: {},
      execute: (subject) => subject.equals(makeEmail('bob@example.com')),
      expectedOutcome: 'false',
    },
  ],
};

// ---------------------------------------------------------------------------
// Money Value Object
// ---------------------------------------------------------------------------

interface MoneyVO {
  readonly amount: number;
  readonly currency: string;
  add(other: MoneyVO): MoneyVO;
  format(): string;
  isZero(): boolean;
  isPositive(): boolean;
}

function makeMoney(amount: number, currency: string): MoneyVO {
  return {
    amount,
    currency,
    add(other: MoneyVO): MoneyVO {
      if (currency !== other.currency) {
        throw new Error(`Currency mismatch: ${currency} vs ${other.currency}`);
      }
      return makeMoney(amount + other.amount, currency);
    },
    format(): string {
      return `${currency} ${amount.toFixed(2)}`;
    },
    isZero(): boolean {
      return amount === 0;
    },
    isPositive(): boolean {
      return amount > 0;
    },
  };
}

export const MoneyModule: StoryModule<MoneyVO> = {
  meta: {
    title: 'Money Value Object',
    description: 'Demonstrates the Money VO — currency handling and arithmetic.',
    component: 'MoneyValueObject',
    tags: ['value-object', 'ddd', 'money'],
    create: () => makeMoney(100.0, 'USD'),
  },
  stories: [
    {
      name: 'format prints amount with currency',
      description: 'format() should produce a human-readable string.',
      args: {},
      execute: (subject) => subject.format(),
      expectedOutcome: 'USD 100.00',
    },
    {
      name: 'add combines two matching currencies',
      description: 'add() returns a new VO with the summed amount.',
      args: {},
      execute: (subject) => subject.add(makeMoney(50, 'USD')).amount,
      expectedOutcome: '150',
    },
    {
      name: 'add throws on currency mismatch',
      description: 'Mismatched currencies must raise an error.',
      args: {},
      execute: (subject): unknown => {
        try {
          subject.add(makeMoney(10, 'EUR'));
          return 'no error';
        } catch (e) {
          return e instanceof Error ? 'error thrown' : 'unknown';
        }
      },
      expectedOutcome: 'error thrown',
    },
    {
      name: 'isZero false for positive amount',
      description: 'A $100 value is not zero.',
      args: {},
      execute: (subject) => subject.isZero(),
      expectedOutcome: 'false',
    },
    {
      name: 'isPositive true for positive amount',
      description: 'A $100 value is positive.',
      args: {},
      execute: (subject) => subject.isPositive(),
      expectedOutcome: 'true',
    },
  ],
};
