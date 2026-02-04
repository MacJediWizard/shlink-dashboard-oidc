import { z } from 'zod';
import { validateFormDataSchema, validateSchema } from '../../app/validation/validator.server';
import { ValidationError } from '../../app/validation/ValidationError.server';

describe('validator.server', () => {
  describe('validateSchema', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it('returns parsed object when valid', () => {
      const result = validateSchema(schema, { name: 'Test', age: 25 });

      expect(result).toEqual({ name: 'Test', age: 25 });
    });

    it('throws ValidationError when schema validation fails', () => {
      expect(() => validateSchema(schema, { name: '', age: -5 }))
        .toThrow(ValidationError);
    });

    it('re-throws non-ZodError exceptions', () => {
      // Create a schema that throws a generic error
      const badSchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as any;

      expect(() => validateSchema(badSchema, {}))
        .toThrow('Unexpected error');
    });
  });

  describe('validateFormDataSchema', () => {
    const schema = z.object({
      username: z.string().min(1),
    });

    it('validates FormData correctly', () => {
      const formData = new FormData();
      formData.append('username', 'testuser');

      const result = validateFormDataSchema(schema, formData);

      expect(result).toEqual({ username: 'testuser' });
    });

    it('throws ValidationError for invalid FormData', () => {
      const formData = new FormData();
      formData.append('username', '');

      expect(() => validateFormDataSchema(schema, formData))
        .toThrow(ValidationError);
    });
  });
});
