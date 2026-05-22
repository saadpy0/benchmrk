export interface KycResult {
    success: boolean;
    message: string;
  }
  
  export interface KycProvider {
    verifyPAN(pan: string, name: string): Promise<KycResult>;
    verifyAadhaar(aadhaar: string): Promise<KycResult>;
  }