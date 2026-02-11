import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface CardData {
  cardId: string;
  userId: string;
  solanaPubkey: string;
  escrowPubkey: string;
  balanceLimit: number;
  balance: number;
  isActive: boolean;
  metadata?: string;
  createdAt: Date;
}

export interface PaymentData {
  id: string;
  cardId: string;
  merchantId: string;
  amount: number;
  merchantReference: string;
  solanaSignature: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

export interface MerchantData {
  id: string;
  name: string;
  solanaPubkey: string;
  solanaTokenAccount: string;
  isActive: boolean;
}

export class AurexAPI {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Aurex API request', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Aurex API request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Aurex API response', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('Aurex API response error', {
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  async registerCard(data: {
    cardId: string;
    userId: string;
    solanaPubkey: string;
    escrowPubkey: string;
    balanceLimit: number;
    metadata?: string;
  }): Promise<void> {
    try {
      await this.client.post('/v1/solana/cards', data);
      logger.info('Card registered in Aurex backend', { cardId: data.cardId });
    } catch (error) {
      logger.error('Failed to register card in Aurex backend', error);
      throw error;
    }
  }

  async getCard(cardId: string, userId: string): Promise<CardData | null> {
    try {
      const response = await this.client.get(`/v1/solana/cards/${cardId}`, {
        params: { userId }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get card from Aurex backend', error);
      throw error;
    }
  }

  async getUserCards(userId: string): Promise<CardData[]> {
    try {
      const response = await this.client.get('/v1/solana/cards', {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get user cards from Aurex backend', error);
      throw error;
    }
  }

  async updateCardBalance(
    cardId: string,
    amount: number,
    operation: 'top_up' | 'payment'
  ): Promise<void> {
    try {
      await this.client.patch(`/v1/solana/cards/${cardId}/balance`, {
        amount,
        operation
      });
      logger.info('Card balance updated in Aurex backend', {
        cardId,
        amount,
        operation
      });
    } catch (error) {
      logger.error('Failed to update card balance in Aurex backend', error);
      throw error;
    }
  }

  async deactivateCard(cardId: string): Promise<void> {
    try {
      await this.client.patch(`/v1/solana/cards/${cardId}/deactivate`);
      logger.info('Card deactivated in Aurex backend', { cardId });
    } catch (error) {
      logger.error('Failed to deactivate card in Aurex backend', error);
      throw error;
    }
  }

  async getMerchant(merchantId: string): Promise<MerchantData | null> {
    try {
      const response = await this.client.get(`/v1/merchants/${merchantId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get merchant from Aurex backend', error);
      throw error;
    }
  }

  async recordPayment(data: {
    cardId: string;
    merchantId: string;
    amount: number;
    merchantReference: string;
    solanaSignature: string;
  }): Promise<PaymentData> {
    try {
      const response = await this.client.post('/v1/solana/payments', data);
      logger.info('Payment recorded in Aurex backend', {
        paymentId: response.data.id,
        cardId: data.cardId
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to record payment in Aurex backend', error);
      throw error;
    }
  }

  async getPaymentHistory(params: {
    userId: string;
    cardId?: string;
    limit: number;
    offset: number;
  }): Promise<PaymentData[]> {
    try {
      const response = await this.client.get('/v1/solana/payments', {
        params
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get payment history from Aurex backend', error);
      throw error;
    }
  }

  async updatePaymentStatus(
    paymentId: string,
    status: 'completed' | 'failed',
    solanaSignature?: string
  ): Promise<void> {
    try {
      await this.client.patch(`/v1/solana/payments/${paymentId}/status`, {
        status,
        solanaSignature
      });
      logger.info('Payment status updated in Aurex backend', {
        paymentId,
        status
      });
    } catch (error) {
      logger.error('Failed to update payment status in Aurex backend', error);
      throw error;
    }
  }
}