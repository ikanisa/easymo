# SMS Parsing Architecture

## Overview

The EasyMO SMS parsing system uses a cascading AI parser architecture to extract structured payment data from mobile money SMS notifications. This system integrates with MomoTerminal to provide vendors with real-time transaction tracking.

## Parser Priority

The system uses three parsers in priority order:

### 1. OpenAI GPT-3.5-turbo (PRIMARY)

- **Accuracy**: 95-97%
- **Cost**: ~$0.002/SMS
- **Used when**: API key configured and service available
- **Best for**: Complex SMS formats, multi-language messages

### 2. Google Gemini 1.5 Flash (FALLBACK)

- **Accuracy**: 93-95%
- **Cost**: ~$0.0001/SMS
- **Used when**: OpenAI fails or is unavailable
- **Best for**: Cost-effective AI parsing with good accuracy

### 3. Regex Parser (FINAL FALLBACK)

- **Accuracy**: 80-85%
- **Cost**: $0 (local processing)
- **Used when**: Both AI services fail or offline
- **Best for**: Standard SMS formats, offline environments

## Data Flow

```
MomoTerminal App          →    Supabase               →    EasyMO Portal
─────────────────              ─────────────               ─────────────
1. Receive SMS                                            
2. Parse with OpenAI/Gemini/Regex                         
3. Save with parsed_by field  →  vendor_sms_transactions  →  Display parser badge
4. Sync to Supabase                                       →  Show confidence score
                                                          →  Parser breakdown stats
```

## Database Schema

### vendor_sms_transactions

The `vendor_sms_transactions` table tracks all parsed SMS transactions with parser metadata:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `vendor_id` | UUID | References sms_parsing_vendors |
| `raw_sms` | TEXT | Original SMS content |
| `parsed_by` | TEXT | Which parser: 'openai', 'gemini', 'regex' |
| `ai_confidence` | DECIMAL(3,2) | Confidence score 0.00-1.00 |
| `parsed_json` | JSONB | Full AI response for debugging |
| `payer_name` | TEXT | Extracted payer name |
| `payer_phone` | TEXT | Extracted payer phone |
| `amount` | DECIMAL(15,2) | Transaction amount |
| `currency` | TEXT | Currency code (RWF, USD, etc.) |
| `txn_id` | TEXT | Mobile money transaction ID |
| `provider` | TEXT | 'mtn', 'vodafone', 'airteltigo' |
| `status` | TEXT | 'raw', 'parsed', 'matched', 'error' |

## Tracking Fields

### parsed_by

Indicates which parser successfully extracted the data:

- **`openai`**: Parsed by OpenAI GPT-3.5-turbo (primary)
- **`gemini`**: Parsed by Google Gemini 1.5 Flash (fallback)
- **`regex`**: Parsed by regex patterns (final fallback)

### ai_confidence

A decimal value from 0.00 to 1.00 indicating the AI's confidence in the parse:

- **≥ 0.90**: High confidence (green badge)
- **0.70-0.89**: Medium confidence (yellow badge)
- **0.50-0.69**: Low confidence (orange badge)
- **< 0.50**: Very low confidence (red badge)

Regex parsers typically don't provide confidence scores (shown as "—").

## UI Components

### ParserBadge

Displays which parser was used with visual styling:

- 🤖 **OpenAI** - Green badge (primary parser)
- ✨ **Gemini** - Blue badge (fallback parser)
- 📝 **Regex** - Gray badge (offline parser)

### ConfidenceBadge

Shows AI confidence as a percentage with color coding:

- **90-100%**: Green (high confidence)
- **70-89%**: Yellow (medium confidence)
- **50-69%**: Orange (low confidence)
- **0-49%**: Red (very low confidence)

### Parser Breakdown Stats

Dashboard card showing parser usage distribution:

```tsx
🤖 OpenAI (Primary)    : 1,234
✨ Gemini (Fallback)   : 56
📝 Regex (Offline)     : 12
```

## Parser Selection Logic

```typescript
async function parseSMS(smsText: string): Promise<ParsedSMS> {
  let result: ParsedSMS;
  
  // Try OpenAI first
  try {
    result = await parseWithOpenAI(smsText);
    result.parsed_by = 'openai';
    return result;
  } catch (error) {
    console.warn('OpenAI parsing failed, trying Gemini');
  }
  
  // Fallback to Gemini
  try {
    result = await parseWithGemini(smsText);
    result.parsed_by = 'gemini';
    return result;
  } catch (error) {
    console.warn('Gemini parsing failed, using regex');
  }
  
  // Final fallback to regex
  result = await parseWithRegex(smsText);
  result.parsed_by = 'regex';
  return result;
}
```

## Performance Optimization

### Caching

- Cache parser responses for identical SMS text
- TTL: 24 hours
- Reduces API costs by ~40%

### Batch Processing

- Process SMS in batches of 10-50
- Reduces API overhead
- Improves throughput by ~3x

### Cost Monitoring

Track parser costs in real-time:

```sql
-- Daily parser costs
SELECT 
  parsed_by,
  COUNT(*) as transaction_count,
  CASE 
    WHEN parsed_by = 'openai' THEN COUNT(*) * 0.002
    WHEN parsed_by = 'gemini' THEN COUNT(*) * 0.0001
    ELSE 0
  END as estimated_cost
FROM vendor_sms_transactions
WHERE created_at >= CURRENT_DATE
GROUP BY parsed_by;
```

## Monitoring & Alerts

### Key Metrics

1. **Parser Success Rate**: % of SMS successfully parsed
2. **Parser Distribution**: Ratio of openai:gemini:regex usage
3. **Average Confidence**: Mean AI confidence score
4. **Parse Latency**: Time to parse SMS

### Alert Thresholds

- OpenAI failure rate > 10%: Switch to Gemini priority
- Regex usage > 30%: Investigate AI service issues
- Average confidence < 0.70: Review parser prompts

## Testing

### Unit Tests

```typescript
describe('SMS Parser', () => {
  it('should use OpenAI for primary parsing', async () => {
    const result = await parseSMS(sampleSMS);
    expect(result.parsed_by).toBe('openai');
  });
  
  it('should fallback to Gemini when OpenAI fails', async () => {
    mockOpenAI.mockRejectedValue(new Error('API Error'));
    const result = await parseSMS(sampleSMS);
    expect(result.parsed_by).toBe('gemini');
  });
  
  it('should use regex when all AI parsers fail', async () => {
    mockOpenAI.mockRejectedValue(new Error('API Error'));
    mockGemini.mockRejectedValue(new Error('API Error'));
    const result = await parseSMS(sampleSMS);
    expect(result.parsed_by).toBe('regex');
  });
});
```

### Integration Tests

Test with real SMS samples from each provider:

- MTN Rwanda
- Vodafone Ghana
- AirtelTigo Ghana

## Future Enhancements

1. **Claude AI Integration**: Add Anthropic Claude as additional fallback
2. **Custom ML Model**: Train domain-specific model for SMS parsing
3. **Feedback Loop**: Learn from manual corrections to improve accuracy
4. **Multi-language Support**: Extend to French, Swahili, Arabic SMS
5. **Real-time Analytics**: Live dashboard of parser performance

## References

- [OpenAI API Pricing](https://openai.com/pricing)
- [Google Gemini API](https://ai.google.dev/)
- [MomoTerminal Documentation](../OMNICHANNEL_SMS_IMPLEMENTATION.md)
- [Vendor Portal Guide](../admin-app/README.md)
