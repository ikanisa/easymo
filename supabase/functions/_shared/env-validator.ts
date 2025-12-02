/**
 * Environment Variable Validator
 * Run this at service startup to validate configuration
 */

type EnvRequirement = {
  names: string[];
  required: boolean;
  description: string;
  validate?: (value: string) => boolean;
  productionOnly?: boolean;
};

const ENV_REQUIREMENTS: EnvRequirement[] = [
  {
    names: ["SUPABASE_URL", "SERVICE_URL"],
    required: true,
    description: "Supabase project URL",
    validate: (v) => v.startsWith("https://") && v.includes("supabase"),
  },
  {
    names: ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "WA_SUPABASE_SERVICE_ROLE_KEY"],
    required: true,
    description: "Supabase service role key",
    validate: (v) => v.startsWith("eyJ") && v.length > 100,
  },
  {
    names: ["WHATSAPP_APP_SECRET", "WA_APP_SECRET"],
    required: true,
    description: "WhatsApp app secret for signature verification",
    validate: (v) => v.length >= 32,
  },
  {
    names: ["WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"],
    required: true,
    description: "WhatsApp webhook verification token",
  },
  {
    names: ["WA_ALLOW_UNSIGNED_WEBHOOKS"],
    required: false,
    description: "Allow unsigned webhooks (MUST be false in production)",
    validate: (v) => {
      const isProduction = Deno.env.get("ENVIRONMENT") === "production";
      if (isProduction && v.toLowerCase() === "true") {
        console.error("❌ SECURITY ERROR: WA_ALLOW_UNSIGNED_WEBHOOKS cannot be true in production!");
        return false;
      }
      return true;
    },
    productionOnly: true,
  },
];

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
};

export function validateEnvironment(serviceName: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
  };

  console.log(`🔍 Validating environment for ${serviceName}...`);

  for (const req of ENV_REQUIREMENTS) {
    let value: string | undefined;
    let foundName: string | undefined;

    // Try each alternative name
    for (const name of req.names) {
      const v = Deno.env.get(name);
      if (v) {
        value = v;
        foundName = name;
        break;
      }
    }

    if (!value) {
      if (req.required) {
        result.valid = false;
        result.errors.push(`Missing required: ${req.names.join(" or ")} - ${req.description}`);
        result.missing.push(req.names[0]);
      } else {
        result.warnings.push(`Optional not set: ${req.names[0]} - ${req.description}`);
      }
      continue;
    }

    // Run validation if provided
    if (req.validate && !req.validate(value)) {
      result.valid = false;
      result.errors.push(`Invalid value for ${foundName}: ${req.description}`);
    }
  }

  // Log results
  if (result.valid) {
    console.log(`✅ Environment validation passed for ${serviceName}`);
  } else {
    console.error(`❌ Environment validation FAILED for ${serviceName}`);
    result.errors.forEach((e) => console.error(`   - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠️ Warnings:`);
    result.warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  return result;
}

/**
 * Validate and throw if critical errors
 */
export function assertEnvironmentValid(serviceName: string): void {
  const result = validateEnvironment(serviceName);
  if (!result.valid) {
    throw new Error(
      `Environment validation failed for ${serviceName}:\n${result.errors.join("\n")}`
    );
  }
}
