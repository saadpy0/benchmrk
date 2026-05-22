export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    message: string;
  }
  
  export interface PaymentProvider {
    sendPayout(
      amount: number,
      upiId: string,
      creatorName: string,
      reference: string
    ): Promise<PaymentResult>;
  }
  