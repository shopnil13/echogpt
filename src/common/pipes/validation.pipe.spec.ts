import type { ValidationError } from '@nestjs/common';

import { flattenValidationErrors } from './validation.pipe';

describe('flattenValidationErrors', () => {
  it('flattens nested errors into dotted field paths', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
      {
        property: 'profile',
        children: [
          { property: 'name', constraints: { isString: 'name must be a string' }, children: [] },
        ],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'email', errors: ['email must be an email'] },
      { field: 'profile.name', errors: ['name must be a string'] },
    ]);
  });
});
