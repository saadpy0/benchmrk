import { KycProvider, KycResult } from './kyc.provider.js';

export class KycStub implements KycProvider {
  async verifyPAN(pan: string, name: string): Promise<KycResult> {
    // stub — always returns success
    // replace this with real Surepass API call later
    console.log(`[KYC STUB] Verifying PAN: ${pan} for ${name}`);
    return { success: true, message: 'PAN verified successfully' };
  }

  async verifyAadhaar(aadhaar: string): Promise<KycResult> {
    console.log(`[KYC STUB] Verifying Aadhaar: ${aadhaar}`);
    return { success: true, message: 'Aadhaar verified successfully' };
  }
}