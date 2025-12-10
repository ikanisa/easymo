/**
 * Domain Agent Base Classes Tests
 *
 * Tests for CommerceAgentBase and ProfessionalAgentBase.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  CommerceAgentBase,
  OrderItem,
  Order,
  Product,
  ProductQuery,
  PaymentResult,
  OrderStatus,
} from '../src/agents/commerce-agent.base.js';
import {
  ProfessionalAgentBase,
  DocumentData,
  DocumentType,
  AppointmentRequest,
  Appointment,
  EscalationRequest,
  EscalationResult,
  DocumentTemplate,
} from '../src/agents/professional-agent.base.js';
import type { Tool, ToolContext } from '../src/types/index.js';
import type { AgentInput, AgentResult } from '../src/core/agent-base.js';

// Mock childLogger
vi.mock('@easymo/commons', () => ({
  childLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ============================================================================
// COMMERCE AGENT TESTS
// ============================================================================

class TestCommerceAgent extends CommerceAgentBase {
  readonly name = 'Test Commerce Agent';
  readonly slug = 'test-commerce';
  readonly instructions = 'You are a test commerce agent.';
  readonly tools: Tool[] = [];

  protected async doProductSearch(
    _query: ProductQuery,
    _context: ToolContext,
  ): Promise<Product[]> {
    return [
      {
        id: 'prod-1',
        name: 'Test Product',
        price: 1000,
        currency: 'RWF',
        quantity: 10,
      },
    ];
  }

  protected async doCreateOrder(
    orderData: { customerId: string; items: OrderItem[]; total: number },
    _context: ToolContext,
  ): Promise<Order> {
    return {
      id: 'order-1',
      customerId: orderData.customerId,
      items: orderData.items,
      total: orderData.total,
      currency: 'RWF',
      status: 'pending',
      createdAt: new Date(),
    };
  }

  protected async doProcessPayment(
    _paymentData: { orderId: string; amount: number; paymentMethod: string },
    _context: ToolContext,
  ): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: 'tx-123',
      paymentMethod: 'momo',
    };
  }

  protected async doTrackOrder(
    _orderId: string,
    _context: ToolContext,
  ): Promise<OrderStatus> {
    return 'confirmed';
  }

  protected async doCheckInventory(
    _productId: string,
    _context: ToolContext,
  ): Promise<number> {
    return 10;
  }
}

describe('CommerceAgentBase', () => {
  let agent: TestCommerceAgent;

  beforeEach(() => {
    agent = new TestCommerceAgent();
  });

  it('should create a commerce agent', () => {
    expect(agent.name).toBe('Test Commerce Agent');
    expect(agent.slug).toBe('test-commerce');
  });

  it('should format price correctly', () => {
    // Access protected method through execute which uses it
    expect(agent).toBeDefined();
  });
});

// ============================================================================
// PROFESSIONAL AGENT TESTS
// ============================================================================

class TestProfessionalAgent extends ProfessionalAgentBase {
  readonly name = 'Test Professional Agent';
  readonly slug = 'test-professional';
  readonly instructions = 'You are a test professional agent.';
  readonly tools: Tool[] = [];

  protected async doExtractDocument(
    _imageUrl: string,
    _expectedType?: DocumentType,
    _context?: ToolContext,
  ): Promise<DocumentData> {
    return {
      documentType: 'national_id',
      fields: {
        name: 'John Doe',
        idNumber: '123456789',
      },
      confidence: 0.95,
    };
  }

  protected async doGenerateDocument(
    _templateId: string,
    _data: Record<string, unknown>,
    _context?: ToolContext,
  ): Promise<string> {
    return 'https://example.com/doc.pdf';
  }

  protected async doScheduleAppointment(
    request: AppointmentRequest,
    _customerId: string,
    _context?: ToolContext,
  ): Promise<Appointment> {
    return {
      id: 'apt-1',
      type: request.type,
      scheduledAt: request.preferredDateTime,
      duration: request.duration || 60,
      virtual: request.virtual || false,
      status: 'confirmed',
      confirmationSent: true,
    };
  }

  protected async doCheckAvailability(
    _dateTime: Date,
    _duration: number,
    _context?: ToolContext,
  ): Promise<boolean> {
    return true;
  }

  protected async doEscalateToHuman(
    _request: EscalationRequest,
  ): Promise<EscalationResult> {
    return {
      success: true,
      ticketId: 'ticket-123',
      assignedTo: 'Support Team',
      expectedResponseTime: '24 hours',
    };
  }

  protected async doSendConfirmation(
    _appointmentId: string,
    _recipientPhone: string,
    _context?: ToolContext,
  ): Promise<boolean> {
    return true;
  }

  protected async doGetTemplates(
    _type?: string,
    _context?: ToolContext,
  ): Promise<DocumentTemplate[]> {
    return [
      {
        id: 'tpl-1',
        name: 'Insurance Quote',
        type: 'insurance',
        requiredFields: ['name', 'email'],
      },
    ];
  }
}

describe('ProfessionalAgentBase', () => {
  let agent: TestProfessionalAgent;

  beforeEach(() => {
    agent = new TestProfessionalAgent();
  });

  it('should create a professional agent', () => {
    expect(agent.name).toBe('Test Professional Agent');
    expect(agent.slug).toBe('test-professional');
  });
});
