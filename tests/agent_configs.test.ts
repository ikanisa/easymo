import { describe, it, expect, beforeAll } from 'vitest';
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';

/**
 * Agent Configurations Tests
 * 
 * Tests for the 10 official agents matching production agent_registry database:
 * 1. farmer - Farmer AI Agent
 * 2. insurance - Insurance AI Agent
 * 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent
 * 4. rides - Rides AI Agent
 * 5. jobs - Jobs AI Agent
 * 6. waiter - Waiter AI Agent
 * 7. real_estate - Real Estate AI Agent
 * 8. marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop)
 * 9. support - Support AI Agent (includes concierge routing)
 * 10. business_broker - Business Broker AI Agent (includes legal intake)
 */
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

  it('should have exactly 10 official agent configurations', () => {
    expect(configs).toHaveLength(10);
  });

  it('should have the correct 10 official agent slugs', () => {
    const expectedSlugs = [
      'farmer',
      'insurance',
      'sales_cold_caller',
      'rides',
      'jobs',
      'waiter',
      'real_estate',
      'marketplace',
      'support',
      'business_broker'
    ];
    const actualSlugs = configs.map(c => c.slug);
    
    expectedSlugs.forEach(slug => {
      expect(actualSlugs).toContain(slug);
    });
    expect(actualSlugs.length).toBe(expectedSlugs.length);
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
    it('should configure Farmer Agent correctly', () => {
      const farmer = configs.find(c => c.slug === 'farmer');
      expect(farmer).toBeDefined();
      expect(farmer.name).toBe('Farmer AI Agent');
      expect(farmer.autonomy).toBe('suggest');
      expect(farmer.languages).toContain('en');
      expect(farmer.tools).toContain('search_supabase');
      expect(farmer.guardrails.pii_minimization).toBe(true);
    });

    it('should configure Insurance Agent correctly', () => {
      const insurance = configs.find(c => c.slug === 'insurance');
      expect(insurance).toBeDefined();
      expect(insurance.name).toBe('Insurance AI Agent');
      expect(insurance.autonomy).toBe('suggest');
      expect(insurance.tools).toContain('ocr_extract');
      expect(insurance.tools).toContain('price_insurance');
      expect(insurance.tools).toContain('generate_pdf');
      expect(insurance.guardrails.approval_thresholds).toBeDefined();
      expect(insurance.guardrails.approval_thresholds.premium_gt).toBe(500000);
      expect(insurance.guardrails.approval_thresholds.ocr_conf_lt).toBe(0.8);
    });

    it('should configure Sales Cold Caller Agent correctly', () => {
      const sales = configs.find(c => c.slug === 'sales_cold_caller');
      expect(sales).toBeDefined();
      expect(sales.name).toBe('Sales/Marketing Cold Caller AI Agent');
      expect(sales.autonomy).toBe('handoff');
      expect(sales.guardrails.only_preapproved_templates).toBe(true);
      expect(sales.guardrails.quiet_hours_throttle).toBe(true);
    });

    it('should configure Rides Agent correctly', () => {
      const rides = configs.find(c => c.slug === 'rides');
      expect(rides).toBeDefined();
      expect(rides.name).toBe('Rides AI Agent');
      expect(rides.autonomy).toBe('suggest');
      expect(rides.tools).toContain('maps_geosearch');
      expect(rides.guardrails.location_privacy).toBe('coarse_only');
    });

    it('should configure Jobs Agent correctly', () => {
      const jobs = configs.find(c => c.slug === 'jobs');
      expect(jobs).toBeDefined();
      expect(jobs.name).toBe('Jobs AI Agent');
      expect(jobs.autonomy).toBe('suggest');
      expect(jobs.tools).toContain('search_supabase');
    });

    it('should configure Waiter Agent correctly', () => {
      const waiter = configs.find(c => c.slug === 'waiter');
      expect(waiter).toBeDefined();
      expect(waiter.name).toBe('Waiter AI Agent');
      expect(waiter.autonomy).toBe('suggest');
      expect(waiter.tools).toContain('order_create');
      expect(waiter.tools).toContain('momo_charge');
      expect(waiter.guardrails.never_collect_card).toBe(true);
      expect(waiter.guardrails.allergy_check).toBe(true);
      expect(waiter.guardrails.payment_limits.currency).toBe('RWF');
    });

    it('should configure Real Estate Agent correctly', () => {
      const realEstate = configs.find(c => c.slug === 'real_estate');
      expect(realEstate).toBeDefined();
      expect(realEstate.name).toBe('Real Estate AI Agent');
      expect(realEstate.autonomy).toBe('suggest');
      expect(realEstate.tools).toContain('schedule_viewing');
      expect(realEstate.guardrails.address_sharing).toBe('on-viewing');
    });

    it('should configure Marketplace Agent correctly (includes pharmacy, hardware, shop)', () => {
      const marketplace = configs.find(c => c.slug === 'marketplace');
      expect(marketplace).toBeDefined();
      expect(marketplace.name).toBe('Marketplace AI Agent');
      expect(marketplace.autonomy).toBe('suggest');
      // Should include capabilities from pharmacy, hardware, and shop
      expect(marketplace.tools).toContain('inventory_check');
      expect(marketplace.tools).toContain('order_create');
      expect(marketplace.tools).toContain('ocr_extract');
      expect(marketplace.guardrails.medical_advice).toBe('forbidden');
      expect(marketplace.guardrails.pharmacist_review_required).toBe(true);
      expect(marketplace.guardrails.delivery_fee_threshold_kg).toBe(20);
      expect(marketplace.guardrails.substitution_policy).toBe('brand->generic->none');
    });

    it('should configure Support Agent correctly (includes concierge routing)', () => {
      const support = configs.find(c => c.slug === 'support');
      expect(support).toBeDefined();
      expect(support.name).toBe('Support AI Agent');
      expect(support.autonomy).toBe('auto');
      expect(support.languages).toContain('en');
      expect(support.languages).toContain('fr');
      expect(support.languages).toContain('rw');
      expect(support.languages).toContain('sw');
      expect(support.languages).toContain('ln');
      // Should include routing capabilities from concierge-router
      expect(support.guardrails.allow_payments).toBe(false);
      expect(support.guardrails.route_when_confidence_gte).toBe(0.6);
      expect(support.guardrails.summarize_last_messages).toBe(10);
    });

    it('should configure Business Broker Agent correctly (includes legal intake)', () => {
      const broker = configs.find(c => c.slug === 'business_broker');
      expect(broker).toBeDefined();
      expect(broker.name).toBe('Business Broker AI Agent');
      expect(broker.autonomy).toBe('handoff');
      expect(broker.tools).toContain('generate_pdf');
      expect(broker.tools).toContain('momo_charge');
      // Should include legal intake capabilities
      expect(broker.guardrails.advice).toBe('forbidden');
    });
  });

  describe('Removed Agents Verification', () => {
    it('should NOT include concierge-router (merged into support)', () => {
      const concierge = configs.find(c => c.slug === 'concierge-router');
      expect(concierge).toBeUndefined();
    });

    it('should NOT include sora-video (removed)', () => {
      const sora = configs.find(c => c.slug === 'sora-video');
      expect(sora).toBeUndefined();
    });

    it('should NOT include locops (internal utility)', () => {
      const locops = configs.find(c => c.slug === 'locops');
      expect(locops).toBeUndefined();
    });

    it('should NOT include analytics-risk (internal utility)', () => {
      const analytics = configs.find(c => c.slug === 'analytics-risk');
      expect(analytics).toBeUndefined();
    });

    it('should NOT include payments-agent (internal utility)', () => {
      const payments = configs.find(c => c.slug === 'payments-agent');
      expect(payments).toBeUndefined();
    });

    it('should NOT include pharmacy-agent (merged into marketplace)', () => {
      const pharmacy = configs.find(c => c.slug === 'pharmacy-agent');
      expect(pharmacy).toBeUndefined();
    });

    it('should NOT include hardware-agent (merged into marketplace)', () => {
      const hardware = configs.find(c => c.slug === 'hardware-agent');
      expect(hardware).toBeUndefined();
    });

    it('should NOT include shop-agent (merged into marketplace)', () => {
      const shop = configs.find(c => c.slug === 'shop-agent');
      expect(shop).toBeUndefined();
    });

    it('should NOT include property-agent (merged into real_estate)', () => {
      const property = configs.find(c => c.slug === 'property-agent');
      expect(property).toBeUndefined();
    });

    it('should NOT include legal-intake (merged into business_broker)', () => {
      const legal = configs.find(c => c.slug === 'legal-intake');
      expect(legal).toBeUndefined();
    });

    it('should NOT include marketing-sales (merged into sales_cold_caller)', () => {
      const marketing = configs.find(c => c.slug === 'marketing-sales');
      expect(marketing).toBeUndefined();
    });

    it('should NOT include mobility-orchestrator (merged into rides)', () => {
      const mobility = configs.find(c => c.slug === 'mobility-orchestrator');
      expect(mobility).toBeUndefined();
    });
  });

  describe('Tool Assignments', () => {
    it('should assign analytics_log to most agents', () => {
      const agentsWithAnalytics = configs.filter(c => 
        c.tools.includes('analytics_log')
      );
      expect(agentsWithAnalytics.length).toBeGreaterThanOrEqual(8);
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
      // Should include: farmer, waiter, real_estate, marketplace, business_broker, rides
      expect(agentsWithPayment.length).toBeGreaterThanOrEqual(4);
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
      const insurance = configs.find(c => c.slug === 'insurance');
      const businessBroker = configs.find(c => c.slug === 'business_broker');
      const salesColdCaller = configs.find(c => c.slug === 'sales_cold_caller');

      expect(['suggest', 'handoff']).toContain(insurance?.autonomy);
      expect(['suggest', 'handoff']).toContain(businessBroker?.autonomy);
      expect(['suggest', 'handoff']).toContain(salesColdCaller?.autonomy);
    });
  });

  describe('Language Support', () => {
    it('should support multiple languages for customer-facing agents', () => {
      const support = configs.find(c => c.slug === 'support');
      expect(support?.languages.length).toBeGreaterThanOrEqual(5);
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

    it('should never allow direct card collection for waiter', () => {
      const waiter = configs.find(c => c.slug === 'waiter');
      expect(waiter?.guardrails.never_collect_card).toBe(true);
    });

    it('should enforce medical compliance for marketplace agent', () => {
      const marketplace = configs.find(c => c.slug === 'marketplace');
      expect(marketplace?.guardrails.medical_advice).toBe('forbidden');
      expect(marketplace?.guardrails.pharmacist_review_required).toBe(true);
    });

    it('should enforce legal compliance for business broker agent', () => {
      const broker = configs.find(c => c.slug === 'business_broker');
      expect(broker?.guardrails.advice).toBe('forbidden');
    });
  });
});
