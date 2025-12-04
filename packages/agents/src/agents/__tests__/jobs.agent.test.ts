/**
 * Tests for JobsAgent
 * 
 * Tests jobs/career-related functionality including:
 * - Job search
 * - Worker profile creation
 * - Employer verification
 * - Application tracking
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentInput } from '../../types/agent.types';
import { JobsAgent } from '../jobs/jobs.agent';

describe('JobsAgent', () => {
  let agent: JobsAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new JobsAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('jobs_agent');
    });

    it('should have comprehensive instructions', () => {
      expect(agent.instructions).toContain('career coach');
      expect(agent.instructions).toContain('blue-collar workers');
    });

    it('should have guardrails in instructions', () => {
      expect(agent.instructions).toContain('No unverified high-pay promises');
      expect(agent.instructions).toContain('pay to apply');
      expect(agent.instructions).toContain('scams');
    });
  });

  describe('tools', () => {
    it('should have search_gigs tool', () => {
      const tool = agent.tools.find(t => t.name === 'search_gigs');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Find jobs');
    });

    it('should have create_worker_profile tool', () => {
      const tool = agent.tools.find(t => t.name === 'create_worker_profile');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('CV');
    });

    it('should have verify_employer tool', () => {
      const tool = agent.tools.find(t => t.name === 'verify_employer');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('trust score');
    });

    it('should have application_tracker tool', () => {
      const tool = agent.tools.find(t => t.name === 'application_tracker');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('applications');
    });

    it('should have salary_insights tool', () => {
      const tool = agent.tools.find(t => t.name === 'salary_insights');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('market rate');
    });

    it('should have all required tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('search_gigs');
      expect(toolNames).toContain('create_worker_profile');
      expect(toolNames).toContain('verify_employer');
      expect(toolNames).toContain('application_tracker');
      expect(toolNames).toContain('salary_insights');
    });
  });

  describe('tool execution', () => {
    const mockContext = { userId: 'test-worker-123', source: 'whatsapp' as const };

    describe('search_gigs', () => {
      it('should return job listings', async () => {
        const tool = agent.tools.find(t => t.name === 'search_gigs')!;
        
        const result = await tool.execute(
          { role: 'Driver', location: 'Kigali' },
          mockContext
        );

        expect(result.jobs).toBeDefined();
        expect(Array.isArray(result.jobs)).toBe(true);
        expect(result.jobs.length).toBeGreaterThan(0);
      });

      it('should include job details', async () => {
        const tool = agent.tools.find(t => t.name === 'search_gigs')!;
        
        const result = await tool.execute(
          { role: 'Driver' },
          mockContext
        );

        const job = result.jobs[0];
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('salary');
        expect(job).toHaveProperty('verified');
      });
    });

    describe('create_worker_profile', () => {
      it('should create/update worker profile', async () => {
        const tool = agent.tools.find(t => t.name === 'create_worker_profile')!;
        
        const result = await tool.execute(
          { 
            skills: ['driving', 'delivery'],
            experience: '3 years',
            location: 'Kigali'
          },
          mockContext
        );

        expect(result.profile_id).toBeDefined();
        expect(result.status).toBe('updated');
      });
    });

    describe('verify_employer', () => {
      it('should verify employer trust score', async () => {
        const tool = agent.tools.find(t => t.name === 'verify_employer')!;
        
        const result = await tool.execute(
          { employer_id: 'emp-123' },
          mockContext
        );

        expect(result.trust_score).toBeDefined();
        expect(result.verified).toBeDefined();
      });
    });

    describe('application_tracker', () => {
      it('should track job applications', async () => {
        const tool = agent.tools.find(t => t.name === 'application_tracker')!;
        
        const result = await tool.execute(
          { job_id: 'j1', action: 'apply' },
          mockContext
        );

        expect(result.job_id).toBe('j1');
        expect(result.status).toBe('applied');
        expect(result.timestamp).toBeDefined();
      });
    });

    describe('salary_insights', () => {
      it('should return salary range', async () => {
        const tool = agent.tools.find(t => t.name === 'salary_insights')!;
        
        const result = await tool.execute(
          { role: 'Driver', location: 'Kigali' },
          mockContext
        );

        expect(result.min).toBeDefined();
        expect(result.max).toBeDefined();
        expect(result.avg).toBeDefined();
      });
    });
  });

  describe('execute', () => {
    it('should return success response', async () => {
      const input: AgentInput = {
        query: 'I am looking for work',
        userId: 'test-worker-123',
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBeDefined();
    });
  });

  describe('format methods', () => {
    it('should format job option correctly', () => {
      const option = { title: 'Driver', company: 'Logistics Co', salary: 200000 };
      
      const formatted = (agent as any).formatSingleOption(option);
      
      expect(formatted).toContain('Driver');
      expect(formatted).toContain('Logistics Co');
      expect(formatted).toContain('200000');
    });
  });

  describe('guardrails', () => {
    it('should include scam warnings', () => {
      expect(agent.instructions).toContain('scams');
      expect(agent.instructions).toContain('never ask for money');
    });

    it('should include safety advice', () => {
      expect(agent.instructions).toContain('Safety first');
      expect(agent.instructions).toContain('public places');
    });

    it('should include privacy protection', () => {
      expect(agent.instructions).toContain('Respect worker privacy');
    });
  });
});
