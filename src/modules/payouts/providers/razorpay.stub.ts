import type { PaymentProvider, PaymentResult } from './payment.provider.js';

export class RazorpayStub implements PaymentProvider {
  async sendPayout(
    amount: number,
    upiId: string,
    creatorName: string,
    reference: string
  ): Promise<PaymentResult> {
    // stub — simulates a successful Razorpay payout
    // replace this with real Razorpay API calls when credentials are ready
    console.log(`[RAZORPAY STUB] Sending ₹${amount} to ${upiId} for ${creatorName} (ref: ${reference})`);

    // simulate occasional failure (10% of the time) so you can test failure handling
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