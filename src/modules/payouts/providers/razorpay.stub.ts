export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

export class RazorpayStub {
  async sendPayout(
    amount: number,
    upiId: string,
    creatorName: string,
    reference: string
  ): Promise<PaymentResult> {
    console.log(`[RAZORPAY STUB] Sending ₹${amount} to ${upiId} for ${creatorName} (ref: ${reference})`);

    const shouldFail = Math.random() < 0.1;
    if (shouldFail) {
      return {
        success: false,
        message: 'Razorpay payout failed — insufficient funds in platform account',
      };
    }

    return {
      success: true,
      transactionId: `rzp_stub_${Date.now()}`,
      message: `Successfully sent ₹${amount} to ${upiId}`,
    };
  }
}