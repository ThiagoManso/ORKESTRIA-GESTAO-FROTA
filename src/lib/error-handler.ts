import { db, auth } from './firebase';
import { FirestoreErrorInfo } from '../types';

export function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null, silent: boolean = false): never | void {
  const user = auth.currentUser;
  
  const errorInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType: operation,
    path: path,
    authInfo: {
      userId: user?.uid || 'guest',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || '',
      })) || [],
    }
  };

  const jsonError = JSON.stringify(errorInfo);
  console.error('Firestore Error:', jsonError);
  
  if (!silent) {
    throw new Error(jsonError);
  }
}
