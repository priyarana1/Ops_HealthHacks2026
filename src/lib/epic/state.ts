import { equal, hash } from '../security/core';
export function validateState(actual: string, expectedHash: string) { return equal(hash(actual), expectedHash); }
