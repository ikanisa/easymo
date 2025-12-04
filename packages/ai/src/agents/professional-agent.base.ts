/**
 * Professional Services Agent Base Class
 *
 * Base class for all professional/business service agents including:
 * - Insurance Agent
 * - Real Estate Agent
 * - Legal Intake Agent
 * - Business Broker Agent
 *
 * Provides common professional service functionality:
 * - Document extraction (OCR)
 * - Document generation
 * - Appointment scheduling
 * - Human escalation
 *
 * @packageDocumentation
 */

import { AgentBase, AgentConfig, AgentInput, AgentResult } from '../core/agent-base.js';
import type { Tool, ToolContext } from '../types/index.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Document data extracted via OCR
 */
export interface DocumentData {
  /** Document type detected */
  documentType: DocumentType;
  /** Extracted fields */
  fields: Record<string, string>;
  /** Extraction confidence (0-1) */
  confidence: number;
  /** Raw text */
  rawText?: string;
  /** Source image URL */
  imageUrl?: string;
}

/**
 * Document types
 */
export type DocumentType =
  | 'national_id'
  | 'passport'
  | 'drivers_license'
  | 'vehicle_registration'
  | 'insurance_certificate'
  | 'property_deed'
  | 'contract'
  | 'receipt'
  | 'unknown';

/**
 * Appointment request
 */
export interface AppointmentRequest {
  /** Appointment type */
  type: AppointmentType;
  /** Preferred date/time */
  preferredDateTime: Date;
  /** Alternative date/time */
  alternativeDateTime?: Date;
  /** Duration in minutes */
  duration?: number;
  /** Location preference */
  location?: string;
  /** Virtual meeting preferred */
  virtual?: boolean;
  /** Notes */
  notes?: string;
}

/**
 * Appointment types
 */
export type AppointmentType =
  | 'property_viewing'
  | 'insurance_consultation'
  | 'legal_consultation'
  | 'business_meeting'
  | 'document_signing'
  | 'phone_call'
  | 'video_call';

/**
 * Scheduled appointment
 */
export interface Appointment {
  /** Appointment ID */
  id: string;
  /** Appointment type */
  type: AppointmentType;
  /** Scheduled date/time */
  scheduledAt: Date;
  /** Duration in minutes */
  duration: number;
  /** Location or meeting link */
  location?: string;
  /** Is virtual meeting */
  virtual: boolean;
  /** Status */
  status: AppointmentStatus;
  /** Assigned staff member */
  assignedTo?: string;
  /** Confirmation sent */
  confirmationSent: boolean;
}

/**
 * Appointment status
 */
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

/**
 * Escalation request
 */
export interface EscalationRequest {
  /** Reason for escalation */
  reason: string;
  /** Priority level */
  priority: EscalationPriority;
  /** Context/summary */
  context: Record<string, unknown>;
  /** Requested department */
  department?: string;
}

/**
 * Escalation priority
 */
export type EscalationPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Escalation result
 */
export interface EscalationResult {
  /** Whether escalation was successful */
  success: boolean;
  /** Ticket/case ID */
  ticketId?: string;
  /** Assigned to */
  assignedTo?: string;
  /** Expected response time */
  expectedResponseTime?: string;
}

/**
 * Document template
 */
export interface DocumentTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template type */
  type: string;
  /** Required fields */
  requiredFields: string[];
}

// ============================================================================
// PROFESSIONAL AGENT BASE CLASS
// ============================================================================

/**
 * Base class for professional/business service agents
 *
 * Provides common functionality for insurance, real estate, legal,
 * and business broker agents.
 */
export abstract class ProfessionalAgentBase extends AgentBase {
  // Professional-specific tools - to be populated by subclasses
  protected documentTools: Tool[] = [];
  protected schedulingTools: Tool[] = [];
  protected communicationTools: Tool[] = [];

  // OCR confidence threshold
  protected ocrConfidenceThreshold: number = 0.8;

  constructor(config?: AgentConfig) {
    super(config);
  }

  /**
   * Default execute implementation using ReAct pattern
   */
  async execute(input: AgentInput): Promise<AgentResult> {
    this.log('PROFESSIONAL_EXECUTE_START', {
      userId: input.userId,
      conversationId: input.conversationId,
    });

    // Load memory
    const memoryContext = await this.loadMemory(
      input.userId,
      input.conversationId,
      input.message,
    );

    // Build messages
    const messages = this.buildMessages(input, memoryContext);

    // Create context
    const context = {
      userId: input.userId,
      conversationId: input.conversationId,
      agentName: this.name,
      variables: input.context,
      correlationId: this.correlationId,
    };

    // Execute with ReAct pattern
    const result = await this.executeReAct(messages, context);

    // Save to memory
    await this.saveMemory(
      input.userId,
      input.conversationId,
      input.message,
      result.message,
    );

    return result;
  }

  // ========================================================================
  // PROFESSIONAL-SPECIFIC METHODS
  // ========================================================================

  /**
   * Extract data from a document image
   */
  protected async extractDocument(
    imageUrl: string,
    expectedType?: DocumentType,
    context?: ToolContext,
  ): Promise<DocumentData | null> {
    this.log('EXTRACT_DOCUMENT', { imageUrl, expectedType });

    try {
      const data = await this.doExtractDocument(imageUrl, expectedType, context);

      // Check confidence threshold
      if (data.confidence < this.ocrConfidenceThreshold) {
        this.log('EXTRACT_DOCUMENT_LOW_CONFIDENCE', {
          confidence: data.confidence,
          threshold: this.ocrConfidenceThreshold,
        });
      }

      this.log('EXTRACT_DOCUMENT_SUCCESS', {
        documentType: data.documentType,
        confidence: data.confidence,
        fieldsCount: Object.keys(data.fields).length,
      });

      return data;
    } catch (error) {
      this.log('EXTRACT_DOCUMENT_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Generate a document from template
   */
  protected async generateDocument(
    templateId: string,
    data: Record<string, unknown>,
    context?: ToolContext,
  ): Promise<string | null> {
    this.log('GENERATE_DOCUMENT', { templateId });

    try {
      const documentUrl = await this.doGenerateDocument(templateId, data, context);

      this.log('GENERATE_DOCUMENT_SUCCESS', { templateId, documentUrl });
      return documentUrl;
    } catch (error) {
      this.log('GENERATE_DOCUMENT_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Schedule an appointment
   */
  protected async scheduleAppointment(
    request: AppointmentRequest,
    customerId: string,
    context?: ToolContext,
  ): Promise<Appointment | null> {
    this.log('SCHEDULE_APPOINTMENT', {
      type: request.type,
      preferredDateTime: request.preferredDateTime,
      customerId,
    });

    try {
      // Check availability
      const isAvailable = await this.checkAvailability(
        request.preferredDateTime,
        request.duration || 60,
        context,
      );

      if (!isAvailable && request.alternativeDateTime) {
        // Try alternative
        const altAvailable = await this.checkAvailability(
          request.alternativeDateTime,
          request.duration || 60,
          context,
        );

        if (altAvailable) {
          request.preferredDateTime = request.alternativeDateTime;
        }
      }

      const appointment = await this.doScheduleAppointment(request, customerId, context);

      this.log('SCHEDULE_APPOINTMENT_SUCCESS', {
        appointmentId: appointment.id,
        scheduledAt: appointment.scheduledAt,
      });

      return appointment;
    } catch (error) {
      this.log('SCHEDULE_APPOINTMENT_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Check availability for a time slot
   */
  protected async checkAvailability(
    dateTime: Date,
    duration: number,
    context?: ToolContext,
  ): Promise<boolean> {
    try {
      return await this.doCheckAvailability(dateTime, duration, context);
    } catch (error) {
      this.log('CHECK_AVAILABILITY_ERROR', { error: String(error) });
      return false;
    }
  }

  /**
   * Escalate to human staff
   */
  protected async escalateToHuman(
    reason: string,
    priority: EscalationPriority,
    context: Record<string, unknown>,
    department?: string,
  ): Promise<EscalationResult> {
    this.log('ESCALATE_TO_HUMAN', {
      reason,
      priority,
      department,
    });

    try {
      const result = await this.doEscalateToHuman(
        {
          reason,
          priority,
          context,
          department,
        },
      );

      this.log('ESCALATE_TO_HUMAN_RESULT', {
        success: result.success,
        ticketId: result.ticketId,
      });

      return result;
    } catch (error) {
      this.log('ESCALATE_TO_HUMAN_ERROR', { error: String(error) });
      return {
        success: false,
      };
    }
  }

  /**
   * Send confirmation notification
   */
  protected async sendConfirmation(
    appointmentId: string,
    recipientPhone: string,
    context?: ToolContext,
  ): Promise<boolean> {
    try {
      return await this.doSendConfirmation(appointmentId, recipientPhone, context);
    } catch (error) {
      this.log('SEND_CONFIRMATION_ERROR', { error: String(error) });
      return false;
    }
  }

  /**
   * Get available templates
   */
  protected async getTemplates(
    type?: string,
    context?: ToolContext,
  ): Promise<DocumentTemplate[]> {
    try {
      return await this.doGetTemplates(type, context);
    } catch (error) {
      this.log('GET_TEMPLATES_ERROR', { error: String(error) });
      return [];
    }
  }

  /**
   * Format date for display
   */
  protected formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Validate required fields in extracted document
   */
  protected validateDocumentFields(
    data: DocumentData,
    requiredFields: string[],
  ): { valid: boolean; missingFields: string[] } {
    const missingFields = requiredFields.filter(
      (field) => !data.fields[field] || data.fields[field].trim() === '',
    );

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  // ========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ========================================================================

  /**
   * Extract document data via OCR
   */
  protected abstract doExtractDocument(
    imageUrl: string,
    expectedType?: DocumentType,
    context?: ToolContext,
  ): Promise<DocumentData>;

  /**
   * Generate document from template
   */
  protected abstract doGenerateDocument(
    templateId: string,
    data: Record<string, unknown>,
    context?: ToolContext,
  ): Promise<string>;

  /**
   * Schedule appointment implementation
   */
  protected abstract doScheduleAppointment(
    request: AppointmentRequest,
    customerId: string,
    context?: ToolContext,
  ): Promise<Appointment>;

  /**
   * Check availability implementation
   */
  protected abstract doCheckAvailability(
    dateTime: Date,
    duration: number,
    context?: ToolContext,
  ): Promise<boolean>;

  /**
   * Escalate to human implementation
   */
  protected abstract doEscalateToHuman(
    request: EscalationRequest,
  ): Promise<EscalationResult>;

  /**
   * Send confirmation notification
   */
  protected abstract doSendConfirmation(
    appointmentId: string,
    recipientPhone: string,
    context?: ToolContext,
  ): Promise<boolean>;

  /**
   * Get document templates
   */
  protected abstract doGetTemplates(
    type?: string,
    context?: ToolContext,
  ): Promise<DocumentTemplate[]>;
}
