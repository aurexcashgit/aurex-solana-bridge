import Joi from 'joi';

// Validation schemas
export const createCardSchema = Joi.object({
  balanceLimit: Joi.number().positive().required(),
  metadata: Joi.string().max(256).optional(),
  mint: Joi.string().required() // Solana public key
});

export const topUpSchema = Joi.object({
  amount: Joi.number().positive().required(),
  mint: Joi.string().required() // Solana public key
});

export const paymentSchema = Joi.object({
  cardId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  merchantId: Joi.string().required(),
  merchantReference: Joi.string().max(64).required()
});

// Validation functions
export const validateCreateCard = (data: any) => {
  return createCardSchema.validate(data);
};

export const validateTopUp = (data: any) => {
  return topUpSchema.validate(data);
};

export const validatePayment = (data: any) => {
  return paymentSchema.validate(data);
};