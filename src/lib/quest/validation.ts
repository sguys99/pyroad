export interface ValidationInput {
  validationType: 'output_match' | 'contains' | 'code_check';
  expectedOutput: string;
  stdout: string;
  studentCode: string;
}

export interface ValidationResult {
  passed: boolean;
  type: 'output_match' | 'contains' | 'code_check';
}

export function validateResult(input: ValidationInput): ValidationResult {
  const { validationType, expectedOutput, stdout, studentCode } = input;

  switch (validationType) {
    case 'output_match':
      return {
        passed: stdout.trim() === expectedOutput.trim(),
        type: 'output_match',
      };
    case 'contains':
      return {
        passed: stdout.includes(expectedOutput),
        type: 'contains',
      };
    case 'code_check':
      return {
        passed: studentCode.includes(expectedOutput),
        type: 'code_check',
      };
  }
}
