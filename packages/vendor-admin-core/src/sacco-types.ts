/**
 * Stub types for SACCO/Ibimina functionality
 * These replace the @easymo/sacco-core imports that were removed.
 * Full implementation will be provided when SACCO system is finalized.
 */

import { z } from 'zod';

// ======== Ikimina (Savings Groups) ========

export const IkiminaSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    saccoId: z.string().uuid(),
    type: z.enum(['ASCA', 'VSLA', 'SILC', 'ROSCA']),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
    currency: z.string().default('RWF'),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type Ikimina = z.infer<typeof IkiminaSchema>;

export const CreateIkiminaSchema = IkiminaSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type CreateIkimina = z.infer<typeof CreateIkiminaSchema>;

export const UpdateIkiminaSchema = IkiminaSchema.partial().omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type UpdateIkimina = z.infer<typeof UpdateIkiminaSchema>;

// ======== Members ========

export const MemberSchema = z.object({
    id: z.string().uuid(),
    ikiminaId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    phone: z.string().min(10).max(15),
    email: z.string().email().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
    role: z.enum(['MEMBER', 'SECRETARY', 'TREASURER', 'CHAIRPERSON']),
    joinedAt: z.coerce.date(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type Member = z.infer<typeof MemberSchema>;

export const CreateMemberSchema = MemberSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type CreateMember = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = MemberSchema.partial().omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type UpdateMember = z.infer<typeof UpdateMemberSchema>;

// ======== Payments ========

export const PaymentSchema = z.object({
    id: z.string().uuid(),
    ikiminaId: z.string().uuid(),
    memberId: z.string().uuid(),
    type: z.enum(['CONTRIBUTION', 'LOAN_REPAYMENT', 'FINE', 'SHARE_PURCHASE']),
    amount: z.number().positive(),
    currency: z.string().default('RWF'),
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']),
    description: z.string().optional(),
    transactionRef: z.string().optional(),
    paymentDate: z.coerce.date(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentSchema = PaymentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type CreatePayment = z.infer<typeof CreatePaymentSchema>;

export const UpdatePaymentSchema = PaymentSchema.partial().omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type UpdatePayment = z.infer<typeof UpdatePaymentSchema>;
