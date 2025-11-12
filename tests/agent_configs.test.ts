import { describe, it, expect } from 'vitest';
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';

describe('Agent Configurations', () => {
  const configPath = path.join(process.cwd(), 'config', 'agent_configs.yaml');
  let configs: any[];

  beforeAll(() => {
    const content = fs.readFileSync(configPath, 'utf8');
    configs = yaml.parse(content);
  });

  it('should load agent configurations from YAML', () => {
    expect(configs).toBeDefined();
    expect(Array.isArray(configs)).toBe(true);
  });

  it('should have exactly 15 agent configurations', () => {
    expect(configs).toHaveLength(15);
  });

  it('should have unique slugs for all agents', () => {
    const slugs = configs.map(c => c.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(configs.length);
  });

  it('should have all required fields for each agent', () => {
    const requiredFields = ['slug', 'name', 'enabled', 'languages', 'autonomy', 'tools', 'guardrails', 'instructions'];
    
    configs.forEach(config => {
      requiredFields.forEach(field => {
        expect(config).toHaveProperty(field);
      });
    });
  });

  it('should have valid autonomy levels', () => {
    const validAutonomy = ['auto', 'suggest', 'handoff'];
    
    configs.forEach(config => {
      expect(validAutonomy).toContain(config.autonomy);
    });
  });

  it('should have valid language codes', () => {
    const validLanguages = ['en', 'fr', 'rw', 'sw', 'ln'];
    
    configs.forEach(config => {
      expect(Array.isArray(config.languages)).toBe(true);
      config.languages.forEach((lang: string) => {
        expect(validLanguages).toContain(lang);
      });
    });
  });

  it('should have at least one tool for each agent', () => {
    configs.forEach(config => {
      expect(Array.isArray(config.tools)).toBe(true);
      expect(config.tools.length).toBeGreaterThan(0);
    });
  });

  it('should have guardrails object for each agent', () => {
    configs.forEach(config => {
      expect(typeof config.guardrails).toBe('object');
      expect(config.guardrails).not.toBeNull();
    });
  });

  it('should have comprehensive instructions for each agent', () => {
    configs.forEach(config => {
      expect(typeof config.instructions).toBe('string');
      expect(config.instructions.length).toBeGreaterThan(100);
      
      // Check for key instruction sections
      expect(config.instructions).toMatch(/ROLE:/);
      expect(config.instructions).toMatch(/GOAL:/);
    });
  });

  describe('Specific Agent Configurations', () => {
    it('should configure Concierge Router correctly', () => {
      const concierge = configs.find(c => c.slug === 'concierge-router');
      expect(concierge).toBeDefined();
      expect(concierge.name).toBe('Concierge Router');
      expect(concierge.autonomy).toBe('auto');
      expect(concierge.languages).toEqual(['en', 'fr', 'rw', 'sw', 'ln']);
      expect(concierge.tools).toContain('search_supabase');
      expect(concierge.tools).toContain('notify_staff');
      expect(concierge.guardrails.allow_payments).toBe(false);
      expect(concierge.guardrails.pii_minimization).toBe(true);
    });

    it('should configure Waiter AI correctly', () => {
      const waiter = configs.find(c => c.slug === 'waiter-ai');
      expect(waiter).toBeDefined();
      expect(waiter.name).toBe('Waiter AI (Dine-In)');
      expect(waiter.autonomy).toBe('auto');
      expect(waiter.tools).toContain('order_create');
      expect(waiter.tools).toContain('momo_charge');
      expect(waiter.guardrails.never_collect_card).toBe(true);
      expect(waiter.guardrails.allergy_check).toBe(true);
      expect(waiter.guardrails.payment_limits.currency).toBe('RWF');
    });

    it('should configure Mobility Orchestrator correctly', () => {
      const mobility = configs.find(c => c.slug === 'mobility-orchestrator');
      expect(mobility).toBeDefined();
      expect(mobility.autonomy).toBe('suggest');
      expect(mobility.tools).toContain('maps_geosearch');
      expect(mobility.guardrails.location_privacy).toBe('coarse_only');
    });

    it('should configure Pharmacy Agent correctly', () => {
      const pharmacy = configs.find(c => c.slug === 'pharmacy-agent');
      expect(pharmacy).toBeDefined();
      expect(pharmacy.autonomy).toBe('suggest');
      expect(pharmacy.tools).toContain('ocr_extract');
      expect(pharmacy.guardrails.medical_advice).toBe('forbidden');
      expect(pharmacy.guardrails.pharmacist_review_required).toBe(true);
    });

    it('should configure Insurance Agent correctly', () => {
      const insurance = configs.find(c => c.slug === 'insurance-agent');
      expect(insurance).toBeDefined();
      expect(insurance.autonomy).toBe('suggest');
      expect(insurance.tools).toContain('ocr_extract');
      expect(insurance.tools).toContain('price_insurance');
      expect(insurance.tools).toContain('generate_pdf');
      expect(insurance.guardrails.approval_thresholds).toBeDefined();
      expect(insurance.guardrails.approval_thresholds.premium_gt).toBe(500000);
      expect(insurance.guardrails.approval_thresholds.ocr_conf_lt).toBe(0.8);
    });

    it('should configure Sora Video Agent correctly', () => {
      const sora = configs.find(c => c.slug === 'sora-video');
      expect(sora).toBeDefined();
      expect(sora.name).toBe('Sora-2 Video Ads');
      expect(sora.autonomy).toBe('handoff');
      expect(sora.tools).toContain('sora_generate_video');
      expect(sora.guardrails.require_brand_kit).toBe(true);
      expect(sora.guardrails.require_consent_registry).toBe(true);
      expect(sora.guardrails.sora_params).toBeDefined();
      expect(sora.guardrails.sora_params.allowed_models).toEqual(['sora-2', 'sora-2-pro']);
      expect(sora.guardrails.sora_params.allowed_seconds).toEqual([4, 8, 12]);
    });

    it('should configure Legal Intake Agent correctly', () => {
      const legal = configs.find(c => c.slug === 'legal-intake');
      expect(legal).toBeDefined();
      expect(legal.autonomy).toBe('handoff');
      expect(legal.guardrails.advice).toBe('forbidden');
    });

    it('should configure Support & Handoff Agent correctly', () => {
      const support = configs.find(c => c.slug === 'support-handoff');
      expect(support).toBeDefined();
      expect(support.autonomy).toBe('auto');
      expect(support.guardrails.summarize_last_messages).toBe(10);
    });
  });

  describe('Tool Assignments', () => {
    it('should assign analytics_log to most agents', () => {
      const agentsWithAnalytics = configs.filter(c => 
        c.tools.includes('analytics_log')
      );
      expect(agentsWithAnalytics.length).toBeGreaterThanOrEqual(10);
    });

    it('should assign notify_staff to escalation-capable agents', () => {
      const agentsWithNotify = configs.filter(c => 
        c.tools.includes('notify_staff')
      );
      expect(agentsWithNotify.length).toBeGreaterThan(0);
    });

    it('should assign momo_charge only to payment-handling agents', () => {
      const agentsWithPayment = configs.filter(c => 
        c.tools.includes('momo_charge')
      );
      
      // Should include: waiter, mobility, pharmacy, hardware, shop, insurance, property, legal, payments
      expect(agentsWithPayment.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Autonomy Distribution', () => {
    it('should have appropriate distribution of autonomy levels', () => {
      const autonomyCounts = configs.reduce((acc, config) => {
        acc[config.autonomy] = (acc[config.autonomy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(autonomyCounts.auto).toBeGreaterThan(0);
      expect(autonomyCounts.suggest).toBeGreaterThan(0);
      expect(autonomyCounts.handoff).toBeGreaterThan(0);
    });

    it('should mark high-risk agents as suggest or handoff', () => {
      const insurance = configs.find(c => c.slug === 'insurance-agent');
      const legal = configs.find(c => c.slug === 'legal-intake');
      const sora = configs.find(c => c.slug === 'sora-video');

      expect(['suggest', 'handoff']).toContain(insurance?.autonomy);
      expect(['suggest', 'handoff']).toContain(legal?.autonomy);
      expect(['suggest', 'handoff']).toContain(sora?.autonomy);
    });
  });

  describe('Language Support', () => {
    it('should support multiple languages for customer-facing agents', () => {
      const concierge = configs.find(c => c.slug === 'concierge-router');
      const support = configs.find(c => c.slug === 'support-handoff');

      expect(concierge?.languages.length).toBeGreaterThanOrEqual(4);
      expect(support?.languages.length).toBeGreaterThanOrEqual(4);
    });

    it('should support English and French for all agents', () => {
      configs.forEach(config => {
        expect(config.languages).toContain('en');
        expect(config.languages).toContain('fr');
      });
    });
  });

  describe('Guardrails Compliance', () => {
    it('should enforce PII minimization where appropriate', () => {
      const agentsWithPII = configs.filter(c => 
        c.guardrails.pii_minimization === true
      );
      expect(agentsWithPII.length).toBeGreaterThan(5);
    });

    it('should never allow direct card collection', () => {
      const waiter = configs.find(c => c.slug === 'waiter-ai');
      const payments = configs.find(c => c.slug === 'payments-agent');

      expect(waiter?.guardrails.never_collect_card).toBe(true);
      expect(payments?.guardrails.direct_card_details).toBe('forbidden');
    });

    it('should enforce medical compliance for pharmacy agent', () => {
      const pharmacy = configs.find(c => c.slug === 'pharmacy-agent');
      expect(pharmacy?.guardrails.medical_advice).toBe('forbidden');
      expect(pharmacy?.guardrails.pharmacist_review_required).toBe(true);
    });

    it('should enforce legal compliance for legal agent', () => {
      const legal = configs.find(c => c.slug === 'legal-intake');
      expect(legal?.guardrails.advice).toBe('forbidden');
    });
  });
});
